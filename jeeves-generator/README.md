# Experimental generator foundation

## Current state

- **Input:** a saved schema-3 design (`design.json`) built from modules.
- **Output:** a standalone Node 24 and TypeScript project for local Docker Compose. With
  Runnable processes on it has one process per application tile, the providers they use
  (PostgreSQL, RabbitMQ or the Pub/Sub emulator, Valkey, Garage, OpenSearch, Keycloak), an nginx edge, and `.jeeves/`
  with the manifest and report.
- **Templates (9):** Sign-in, Multipart upload, Upload lifecycle, Video encoding, Cache read,
  Event counter, Search indexing, Search query and Favorites. Any other module exports as a
  typed stub.
- **Yours to write:** each template's `<lead>.hooks.ts`, each stub's `<module>.ts` and each
  writer's product SQL file. `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are yours
  too: add a package your modules use with `pnpm add <name>@<exact version>`.
- **Commands:** `pnpm --filter @jeeves/generator export:v2 <design.json> <new directory>`. The
  studio's Generate project dialog produces the same files as a ZIP.
  `pnpm --filter @jeeves/generator update:v2 <design.json> <existing export> [--check]`
  regenerates into an existing export in place
  ([updating an existing export](#updating-an-existing-export)).
- **Not provided:** deployment to anything but local Compose, a browser UI, and load or runtime
  certification.
- **Legacy:** the frozen `youtube-local-v1` profile (the sections from API to Preserving work)
  is kept for exact legacy snapshot exports and regression checks: Generate project offers it
  only for the exact frozen YouTube v1 source, and `export:new` writes it. New module-authored
  projects use `local-v2`.

New exports use extension API **v6 (`checked-extensions`)**. Product code imports types and
helpers from `src/extension-api/index.ts`; shared DTOs and pure definitions belong in the
application-owned `src/contracts/` directory. Run `pnpm check:extensions` offline (also part of
`pnpm build`). It checks private runtime/driver/cross-service imports, policy effect APIs and
template-owned file hashes. This catches cooperative mistakes, not hostile JavaScript.

Product policy callbacks are synchronous and receive copied, frozen DTO objects. Generated
bridges retain transaction, guard, credentials and lifecycle authority. Custom SQL, token
verification and arbitrary HTTP target handles are unavailable public capabilities and appear as
selection-specific custom gaps; a cache loader's `ProductQueries` handle also remains unavailable
until a registered query binding is installed. Existing unrestricted exports remain readable;
an update from API v1 refuses until `--ack-extension-api=6` and a successful staged interface and
boundary check. Handwritten bodies are preserved, never rewritten to claim compatibility.

`pnpm test:generated` separately exports, builds and runs the Activity backend with real
PostgreSQL, RabbitMQ and generated processes. Its core scenario asserts edge publication,
a committed count and matching durable receipt; it does not replace the offline or studio
regression checks. See [system fixture commands and evidence](../field-projects/generator-system/README.md).

The rest of this page is reference.

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
custom implementation credit. In a v2 export the foundation's `package.json`,
`pnpm-lock.yaml` and `pnpm-workspace.yaml` are `generated-extension`, with the template's pins:
the application adds the packages its stubs and hooks use with `pnpm add <name>@<exact version>`,
which edits no generated file, and the image still installs exactly the lock (`pnpm install
--frozen-lockfile --ignore-scripts`). pnpm 12 refuses an install that would skip a package's
install script it hasn't been told about (`ERR_PNPM_IGNORED_BUILDS`), and the Pub/Sub client's
`protobufjs` has a postinstall script (a version warning), which the image never runs. The export's
`pnpm-workspace.yaml` says so (`allowBuilds: { protobufjs: false }`), so a plain `pnpm install
--frozen-lockfile` and `pnpm add` pass with the lock unchanged; an application whose own package
needs its script adds it there.
`.jeeves/` is reserved for the generator. Duplicate paths,
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

## Updating an existing export

```
pnpm --filter @jeeves/generator update:v2 /path/design.json /absolute/existing-directory [--check]
```

`update:v2` assembles the design and regenerates it into a directory that `export:v2` or an
earlier update wrote. The directory's `.jeeves/manifest.json` records what was generated. It
prints the result as JSON: `refused`, the `counts` of `create`, `replace`, `unchanged` and
`keep`, and the paths in `keepChanged`, `override`, `remove` and `orphan`. It exits 1 when
`refused` is not empty. In code, `updateDirectory(bundle, directory, { check })` does the same
with what `assembleV2` returns, and the pure `planUpdate` decides each file.

- **Rewritten:** a generated file (every file but the application's own, `.jeeves/` metadata
  included) is created when it is missing, `unchanged` when it already has the new bytes, and
  replaced when it still has the bytes the old manifest recorded. One the new export no longer
  has is removed when unedited.
- **Kept:** the application's own files (hook files, stub bodies, product SQL, `package.json`
  and `pnpm-lock.yaml`) are never overwritten or removed. A missing one is created, and one that
  already has the new bytes is `unchanged`. One whose template bytes didn't change is `keep`. One
  whose template bytes changed is `keepChanged`, and its new bytes go to
  `.jeeves/generated/<path>` to compare with yours (a new template pin lands in
  `.jeeves/generated/package.json` and `pnpm-lock.yaml` this way). The same holds when the old
  manifest records one of these files as generated (an older export's package manifests), and an
  override listed for one changes nothing. One the export no longer has is `orphan` and stays
  where it is. Files neither manifest lists are never touched. `compose.override.yaml` beside
  `compose.yaml` is one: no export writes it, and it is where the application gives its modules
  their own environment, secrets and services.
- **Refused:** a generated file edited by hand, a file in the way of a new generated path, an
  edited generated file the export dropped, an application's file the new export would make
  generated (`ownership changed: <path>`), and an override that is in neither manifest and has no
  file (`unknown override: <path>`). `refused` names each one. Put the file back, or list it as
  an override; either way the edit is a [template gap](../docs/template-gaps.md).

**Preflight.** Before anything changes, and also with `--check`, the update refuses a path that
is not an absolute directory, free of symlinks, holding a v2 manifest (`Not a Jeeves v2 export`),
an invalid `.jeeves/manifest.json` or `.jeeves/overrides.json`, two paths that differ only in
case or a file that would become a directory, and a symlink, a target that is not a regular file
or a parent that is not a directory on any path it reads or writes (`Unsafe update path:
<path>`). A refused or unsafe update changes nothing. Otherwise it writes each file to a
temporary file beside it and renames it over the target, so a stopped update never leaves a
half-written file, and writes `.jeeves/manifest.json` last. It touches no file outside the two
manifests and the overrides, except `.jeeves/manifest.json` and files under
`.jeeves/generated/`.

**`.jeeves/overrides.json`** lists generated files the application keeps as its own:

```json
{ "overrides": [{ "path": "compose.yaml", "reason": "…" }] }
```

Each `reason` is a non-empty string, and no path is under `.jeeves/`. An override is never
rewritten or recreated, and every update writes its new bytes to `.jeeves/generated/<path>`. An
edited override the export no longer has is `orphan`, update after update.

**`.jeeves/generated/`** holds those shadows. A shadow stays across updates, and keeps a changed
file of yours `keepChanged`, until your file equals the new bytes or you delete the shadow to
accept your file as it is (an override's shadow comes back while it stays listed). The update
deletes the shadows it no longer needs, and the folder once it is empty.

**`--check`** runs the preflight and prints the same result, and writes nothing to the export.

The manifest and support report record `extensionApi.version` separately from the saved design
schema. Missing version metadata means the original unrestricted API, version 1. Existing v1
updates remain compatible. `.jeeves/extensions.md` describes that contract and names the future
public API location; it does not claim that the guarded API exists yet. The normalized model and
report also list installed callable contracts with stable module/process/owner IDs, source paths,
effects, declared access, caller requirements and the generated lifecycle mechanism. Currently
these records cover the existing Favorites HTTP operations, not future capabilities.

An incompatible version update refuses and names handwritten hook/stub paths. Migrate those
files yourself, then pass `--ack-extension-api=<target version>` (also accepted with `--check`).
The updater first copies application source to a temporary staging directory, overlays the new
generated files, and runs the installed TypeScript compiler with `--noEmit` against that copy.
Thus a migrated hook can reference the new interface before the old checkout has that runtime.
The updater never rewrites handwritten bodies. A failed build or acknowledgement writes nothing
to the export; scratch files are always removed. The copy omits `.runtime`, `.git`, `.env` files,
`dist` and dependency trees; it uses the export's installed dependencies. Install the target
export's exact dependencies offline beforehand when they change. Resolve generated overrides
before migration. This is an interface/build check, not runtime proof or a hostile-code sandbox.

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
  property per connected slot, named after the target tile or module (never `settings`), and a
  `slots` descriptor naming the tile, its host link and how it is used. Each unconnected slot is
  a comment line, such as `// outbox: not connected (Database, write, optional)`. Its last
  property is `settings: SettingsOf<typeof import("./<module>.ts")>`, the values the module's
  own `settings` export declares (none when it has none).
- `src/modules/<host>/<module>.ts` (extension): an entry point named after the module that takes
  `Dependencies` and throws `Not implemented: <name>`, after
  `export const settings = declareSettings({});` (Settings a stub declares, below).
- one shared `src/modules/dependencies.ts` (scaffold): a minimal interface per tile kind and use
  (database read or read-write, queue publish or consume, object read or write, cache, search
  read or write, token verifier, HTTP target, module call).
- one shared `src/runtime/settings.ts` (scaffold, QL05): `declareSettings`, the kinds and
  `readSettings`.

Stubs import no template library (only their own `src/runtime/settings.ts`) and, with Runnable
processes off, provision nothing, so a stub-only export installs and builds. Each stub is a required `custom` gap. A connection changes only the `.slots.ts` file.
Export writes only to a new directory, and `planFileWrites` refuses an edited `<module>.ts` with
`EXISTING_OUTPUT_CHANGED`; [`update:v2`](#updating-an-existing-export) regenerates into an
existing export and keeps your bodies.

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
limits, a Worker's loop concurrency, its template selections and each stub's role (loop, route or
library). Each limit's origin is `template` (a template on the tile consumes the tile's Request
timeout and Concurrency limit, or Concurrency), else `tile` (the tile's own saved value, which only
the process consumes; v3 contract §4), else `fixed` (1000 ms and 1000, or one message at a time).
Where no template on the tile consumes them, they are the tile's normal controls while the option
is on (`process.requestTimeoutMs`, `process.concurrencyLimit` and `process.concurrency` setting
decisions with `process: <tile>`; unsaved, each shows the value the process runs). A Video HLS
worker's concurrency stays its template's fixed 1, with no control. The resolver also adds
`model.delivery` when the design has a CDN tile: the object storage each CDN fronts (its links
and saved origin), with each one's saved access and provider.
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
`GET /readyz` (and compatibility alias `/healthz`) (200 once ready, 503 before and while draining), its module routes, and 404
elsewhere; any process runs its loops, and a process with nothing to run holds an idle timer.
Its admission answers a route with 503 `UNAVAILABLE` while it isn't accepting, `OVERLOADED` at
the Concurrency limit and `DEADLINE` at the Request timeout. Only the first two, before any
handler dispatch, carry generated `Retry-After: 1`. A deadline, generic failure, explicit route
error or returned 503 does not authorize automatic replay. Product Retry-After is removed from
error responses. Each process writes the ready
marker through `runProcess` once its loops have subscribed and its HTTP service listens; just
before it, each mounted or placeholder template logs one `started` line
naming what its startup ran (`{"level":"info","event":"started","tile","module","template","wiring",
"checks"}`, for example `"checks":["sweep at start","publication relay started","subscribed
completion-events--completion-handler","sweep every 30 s"]`). It drains on SIGTERM in reverse: HTTP admission, then loops, then publishers,
clients and pools. Configuration for templates and stubs is checked before any connection.
Shutdown stops admission, signals cancellation and closes dependents in reverse construction
order, once. Its final deadline is **10 seconds from first stop**, including unfinished startup;
a hung hook exits 1 at that bound. Abandonment never proves rollback or that an external effect
failed. Each process owns its own registry and cancellation state.
The foundation accepts process hosts with no selection, closes
`application-services` for them, and substitutes `scripts/local.mjs`'s startup gate (exactly
once, or it refuses) so `first-run` and `start` read `report.processes.runnable` instead of
`applicationComplete`. Composition and primitives also emit `src/runtime/process.ts`, `http.ts`
and `admission.ts` when a process needs them, `amqp.ts` and `delivery.ts` for a loop stub, and
the libraries of the stores a process's stub clients use (below).

**The edge.** When a public HTTP process or a served CDN exists, the processes owner contributes
an `edge` row per public host and the foundation writes `app-edge`: the nginx pinned in
`assets/providers.json`, published at `127.0.0.1:${LOCAL_HTTP_PORT}:8080`, `depends_on` each public
process healthy (and Garage for a CDN route), and healthy on its own `GET /healthz`
(`{"service":"edge","application":"ready"}`). `infra/edge/nginx.conf` routes `/api/<id>/` to
`app-<id>:3000/` (resolved per request through Docker DNS), answers 503
`{"error":"UNAVAILABLE","message":"Service unavailable."}` with `Retry-After: 1` while that process
is down (where nginx would answer 502 or 504, a CDN route's included), and 404 JSON for anything
else, so an internal process is reached only inside the network at `http://app-<id>:3000`, the
value Compose gives a calling process's `JEEVES_TILE_<ID>_URL` (Module clients, below). A process's
own answers, its 503s with their `Retry-After` among them, pass through unchanged. The edge's own answers are JSON whatever a path's extension (`types { }`).
The edge owns the single HTTP port: a service contributing `http: true` beside it refuses, and so
does a tile whose ID is `edge`.

**CDN delivery** (V3-08). A CDN tile in front of exactly one public object storage that the design
provisions (a template's bucket or a stub's) gets the edge route `/cdn/<cdn id>/`, served from that
bucket's local Garage website (`local-objects:3902`, `Host: <bucket>.web.garage.localhost`): read
only (GET and HEAD; any other method 405 `METHOD_NOT_ALLOWED`), ranges passed through, a missing
key 404 `NOT_FOUND`. The `Content-Type` comes from the key's extension for common web media (HLS
playlists and segments, MP4, WebM, audio, VTT, images, JSON, text), else the object's own; each
answer also carries `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`, and
the request's `Authorization` and cookies never reach the bucket. The local edge stands in for the
CDN whatever its saved provider, and doesn't resize images. Any other CDN (none, several or private
origins, another provider, or a bucket nothing reads or writes) serves nothing locally and says why
in an optional `custom` gap `cdn-<cdn id>`. `report.processes.delivery` lists each CDN's path and
bucket, or why it has none, and Preview shows them.

**Module routes** (contract §3–4). Every route sits under `/modules/<module id>`:

- The tile's **sign-in** (v3 contract §2): an Auth guard connected to an Identity selects
  `verified-identity@0.1.0`, and the process builds one `createTileGuard` (the scaffold
  `src/runtime/tile-guard.ts`, emitted when a guard exists) on `createPrincipalVerifier`
  (`OIDC_ISSUER`, the audience in `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, RS256, a 3 s key-set
  timeout, `exp` and `sub` required), which `signInSettings` in `tile-guard.ts` reads and checks
  (QG31). A missing or empty `OIDC_AUDIENCE` fails startup
  (`startup-failed`, naming it), and so does an `OIDC_ISSUER` or `OIDC_JWKS_URL` that isn't an
  absolute `http:` or `https:` URL or holds whitespace, with `Invalid endpoint <variable>`, never
  its value; the issuer is compared with each token's `iss` exactly as it is set. Every module route of the
  tile is mounted through `guard.routes(...)`: **Required** answers 401
  `{"error":"SIGN_IN_REQUIRED","message":"Sign in to continue."}` without a valid
  `Authorization: Bearer` token; **Optional** treats a request without the header as anonymous
  and answers 401 for invalid token/claim/signature verification. An unavailable key dependency
  answers 503. `/healthz`, `/readyz` and `/livez` stay open. `guard.caller(request)` gives `{signedIn: true, principal}` or
  `{signedIn: false}`, verified once per request; `guard.require(request)` gives the principal or
  401. `GET /modules/<guard>/me` answers `{signedIn: true, subject, username}` (the token's
  `preferred_username`, or null) or `{signedIn: false}`. The guard declares no roles and has no
  hooks file: a product adds roles and accounts through Keycloak's admin API (as v2's account
  script did) and checks them in its own hooks.
- A **route stub** (any stub in an HTTP tile that consumes no queue) answers any method on
  `/modules/<module id>` and every path below it. Its `<module>.ts` takes
  `(dependencies, request: ModuleRequest): Promise<ModuleResponse>`; public types come through
  `src/extension-api/index.ts` from the private scaffold `src/modules/entry.ts`. `request.body` is the parsed JSON or text (up to 64 KiB; 400
  for invalid or empty JSON, 413 over the limit, 415 for any other content type), and
  `request.rawBody` the same body's bytes exactly as received, retained before decoding
  (undefined when there is no body). Stub JSON is already decoded before product code; only an
  explicit generated raw route defers decoding for future verified ingress. A `ModuleResponse.headers` value is a string or an array of
  strings; an array sends the header once per value, such as two `Set-Cookie` lines.
  JSON DTO objects are copied and frozen; body bytes are copied. Headers include only `accept`,
  `content-type`, `if-none-match`, `if-modified-since` and `idempotency-key`; Authorization,
  Cookie and other credentials stay private. The live AbortSignal is preserved separately.
  `request.caller` is the tile's sign-in caller, and always
  `{signedIn: false}` in a tile with no guard. `request.signal` is aborted with `Error("DEADLINE")`
  once the tile's Request timeout passes after the stub starts (when the admission answers 503
  `DEADLINE`; the process passes `{ deadlineMs: config.settings.requestTimeoutMs }` to
  `stubRoutes`), or with `Error("CLIENT_CLOSED")` when the client goes before the answer is
  written, or with `Error("PROCESS_STOPPING")` on process shutdown, and never once the stub
  has answered.
  `request.path` is decoded (`%2F` is a slash); `request.rawPath` is the same path as it was sent.
  `defineRoutes(table)`, in `entry.ts`, makes the stub's dispatch from a table keyed
  `"<METHOD> <pattern>"`: DELETE, GET, HEAD, OPTIONS, PATCH, POST or PUT, and a pattern of literal
  and `:name` segments (one non-empty segment each) with no wildcard and no trailing slash but `/`
  itself. The first key in table order whose pattern and method match answers, with
  `request.params` (each segment of `rawPath` decoded once, so `%2F` stays inside a parameter);
  HEAD falls back to GET. Any other path answers 404 `NOT_FOUND`, another method on a matching
  path 405 `METHOD_NOT_ALLOWED` with `Allow` (the path's methods sorted, `GET, HEAD` for a GET),
  and a segment that doesn't decode 400 `INVALID_REQUEST`. A malformed key (`Invalid route <key>`)
  or a second key with the same method and pattern (`Duplicate route <key>`) throws when the table
  is defined, so a table defined at the top of the stub's file fails startup;
  `defineRoutes<Dependencies>` gives `(request, dependencies)` and hands each handler the
  dependencies the stub passes as its second argument.
  A stub that doesn't use it dispatches every method and path itself. Its `dependencies` expose
  bounded handles from the public API; restricted legacy SQL/target handles are named gaps. Library stubs (a Worker's stubs that consume nothing) keep their files, are compiled
  and get their clients, and are called only through another module's link.
- **Multipart uploads** is mounted on its real libraries: its private schema (named from the
  selection ID) with the uploads table (`ownedUploadPersistence`) and a `jobs` outbox in
  migration `100-<selection>.sql`, granted to its host; S3 control and signing clients; the
  transaction; the jobs publisher and outbox relay; and a sweep at start and every 30 s. A sweep
  goes on past an upload it can't finish (an expired upload's cleanup, or an interrupted
  completion whose hook throws) and logs each one, so one bad upload doesn't stop the process
  starting; the upload stays as it was for the next sweep. A failure listing the provider's
  unfinished uploads still fails the sweep (at start, the start), with each upload's error
  beside it in an `AggregateError`. Its six operations are mounted at
  `/modules/<lead>/uploads…`. It needs its tile's Auth guard set to Required (the derivation
  keeps it a stub otherwise). Generated HTTP code requires the verified principal before the
  product's `validate` callback. The product factory receives the object key prefix only. When
  an asset lifecycle names the upload, a private bridge binds its transaction callbacks;
  product callbacks receive DTO arguments without transaction or lifecycle controls.
- **Cache reader** is mounted with `createPositiveReader` on a source login (no grants) and the
  Valkey cache at `GET /modules/<lead>/:key`; null answers 404. The cache's host, port and
  transport come from `cacheEndpoint` (`valkey.ts`): `JEEVES_CACHE_<ID>_HOST`, `_PORT` and `_TLS`, not the bindings file. While the cache is down it reads
  the database: a cache call that rejects or passes its 150 ms deadline makes the reader skip the
  cache for 5 s, and a call that hasn't settled keeps it skipped until it does. The Valkey client
  (`createValkeyCache`) destroys a lost client and connects a new one every 5 s, and logs each
  change, starting with the first connect: `{"level":"info","event":"cache",…,"state":"available"}`
  when the cache is usable, and a `failure` line (`cache <module>`) when it is lost.
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
  `<lead>Hooks(resources: Record<string, never>): FavoritesHooks` with one synchronous hook,
  `eligible(itemId): boolean`, which throws `NotImplemented` (501) until written; only adding
  asks it. Pools stay private to generated code. Its own pool runs at 10 connections and
  2000 ms statements. With processes off it emits the runtime and an unfinished
  `favorites-application-bindings` gap.
- **Search query** (v3 contract §5) is mounted at `GET /modules/<lead>?q=&page=` on its index,
  with the mapping and document from the Index writer that fills that index: the process imports
  that writer's hooks file in generated code. Product hooks do not import another service's
  private hooks; shared product DTOs belong in `src/contracts/`. At start it checks the search service (cluster
  health) and, once the mapping is written, asserts the index (`openSearchIndex` in the scaffold
  `src/runtime/tile-search.ts`: created when missing, also when another process creates it at the
  same moment; refused when its mapping differs). A bad `q` (1–200 characters) or `page` (1–100)
  answers 400 `SEARCH_QUERY`; then a search reaches the writer's `mapping`, its own `preset` and
  `hit`, each 501 until written; then it answers `{q, page, pageSize, total, hits}`, 20 to a page,
  in 750 ms at most.

**Consume loops** (contract §3–5). A loop consumes a topic's subscriber queue or a work queue
itself, through the shared `createConsumer` and delivery runner (manual ack, prefetch equal to its
concurrency, `x-delivery-attempt`, and `<queue>.failed` with `x-terminal-code`); a loop stub on a
Pub/Sub topic consumes its own subscription instead (`pubsubLoop`, below). `startModuleLoop`
takes either through `LoopTransport`, which both implement (`amqpLoop` on a broker binding). On
RabbitMQ a topic's subscriber is the tile's `<topic>--<tile>`, unless the tile has several consuming modules on that
topic: then each gets its own `<topic>--<module>` (tile-processes review row 6), so each receives
every message. The report's `loops` rows name each queue, module and what a failure does, and the
process file's `config.loops` holds each loop's queue, `.failed`, retry limit and concurrency;
stub loops and mounted templates both consume their row (`startModuleLoop`, `loopConsumer`).

- A **loop stub** (any stub, in any tile, connected to consume a queue) gets one loop per queue
  it consumes, at its Worker's Concurrency (one message at a time beside HTTP routes). Its
  `<module>.ts` takes `(dependencies, message:
  ModuleMessage): Promise<void>` (`body`, `messageId`, `headers`, `attempt` from 1, and `source`,
  the queue). Its `.slots.ts` keeps the slot's descriptor, and the consumed queue's property
  becomes a comment: it is the input, not a dependency. "Not implemented" is terminal at once
  (`NOT_IMPLEMENTED`: the message goes to `<queue>.failed` on its first delivery). Any other
  error but an unreachable store (below) is retried 5 times; before retry *n* the handler waits
  `min(250 ms × 2^(n−1), 10 s)` (7.75 s over the five), then the message ends in `.failed` as
  `RETRY_EXHAUSTED`. On a Pub/Sub topic the handler doesn't wait: the message is nacked, and its
  subscription's retry policy spaces the redelivery.
- **Asset lifecycle** runs `startAssetLifecycleWorker` on the results subscriber
  (`<results>--<tile>`, which the processes owner contributes because the template didn't), with
  its publication relay when bound. Its `assets` and `receipts` tables sit in its upload
  selection's schema (one owner), beside the uploads table and the one outbox, whose destinations
  are `jobs` and `publication`; its tile gets a login and grants, and the upload tile `assets`.
- **Video HLS** runs `startMediaWorker` on its jobs work queue (concurrency 1) after
  `verifyVideoRuntime()`, with its results publisher and S3 clients; its process uses the `media`
  image (`target: media`, 21 m stop grace). When a job fails for good and its failure report
  can't be built (`eventId` or `event` throws, or the event doesn't serialize or is over 64 KiB),
  the worker skips the report and logs it; the message still goes to `.failed` with its code and
  the worker goes on consuming. A video whose failure report is skipped is not marked failed at
  once: it stays pending until its ten-minute queue deadline, or processing until its
  thirty-minute processing deadline, and the lifecycle's next sweep then marks it QUEUE_DEADLINE
  or PROCESSING_DEADLINE, if that sweep succeeds (its failure hook runs inside the same
  transaction and can stop it).
- **Event counter** runs `startCounterWorker` on its events subscriber, on its private schema's
  `receipts` and `totals` and the public view `<schema>_public.totals`.
- **Search projection** (v3 contract §5) runs the Index writer on its events subscriber
  (`startSearchIndexWorker`): at start it checks the search service and, once the mapping is
  written, asserts the index; until then it logs `mapping` once and stays up, and each message goes
  to `.failed` as `NOT_IMPLEMENTED` naming the first unwritten hook it reaches. A message's event
  names its document (the event ID must be the message's ID), which is parsed against the mapping
  and upserted at its version (`external_gte`): a repeat or an older version never overwrites a
  newer one, and an older one is done rather than retried; a message that doesn't parse is
  `MALFORMED_MESSAGE`.

A mounted template keeps its own limits and handling: a codec or parse hook that throws is
terminal at once, other failures retry within its limit (lifecycle 10, video 3, counter and search
5). A message that reaches a hook that isn't written goes to `.failed` at once as
`NOT_IMPLEMENTED`, as a stub's does (tile-processes review row 7: a retry can't write it), rather
than the template's generic `MALFORMED_MESSAGE` or retrying to `RETRY_EXHAUSTED`; a code of the
template's own (the media worker's `INVALID_MEDIA`) is kept. In a stub loop and a mounted
template alike, an unreachable store waits 5 s and keeps the attempt: when a failure is a lost,
refused or stalled connection (a socket error such as `ECONNREFUSED`, a PostgreSQL SQLSTATE of
class 08 or 57P01–57P03, `pg`'s "Connection terminated", or its client-side `Query read timeout`
when a stalled database sends no reply), the delivery runner (`unreachable` in `delivery.ts`)
puts the message back on its queue with the same `x-delivery-attempt` 5 s later, so an outage
never sends it to `.failed` (a stall that never ends keeps waiting, as any outage does); its
line's action reads `store unreachable, retry in 5000 ms (attempt not counted)`, and `pnpm stop`
ends the wait at once, leaving the message in its queue. A query that is only slow still spends
an attempt: the server's statement timeout (`57014`) comes first. A failed call to an outside
host keeps the normal retries, an External API's (`externalTarget`) included (a `fetch failed`
counts as unreachable only when it is `httpTarget`'s call to another tile or `identityTarget`'s
to the Identity). A failed message logs one JSON
line: `not-implemented` (`tile`, `module`,
`what`, `queue`, `messageId`, `action`, such as `sent to uploaded.failed (NOT_IMPLEMENTED)`) when
it reached a hook or stub that isn't written, otherwise `loop-error` with the attempt, the error
and the next step. Lines are rate limited like the 501s. Nothing in a loop stops the process, a
lost broker connection included: each broker publisher and consumer (`createPublisher`,
`createConsumer` in `src/runtime/amqp.ts`) keeps one connection at a time and, once it is lost,
opens a new one every 5 s until one opens, while the process keeps serving what doesn't need the
broker. While the broker is away a publish fails at once, so a request that publishes answers 503;
a consumer stops acknowledging, settles the messages in hand (they return to their queue and are
delivered again) and resubscribes once they are settled and the broker is back, keeping the
`.failed` messages. A broker that is down when a process starts still fails its startup. `pnpm stop` cancels
each subscription, cuts a retry wait short (the message is republished for its next attempt) and
settles the message in hand before closing; undelivered messages stay in their queue.
`src/runtime/tile-loop.ts` holds the loop and its handlers, `tile-http.ts` the 501 wrapper and
route stubs, and `tile-process.ts` `NotImplemented`, the log, the `started` line and the failure
log.

**Failure lines.** Each process file creates one failure log,
`const failure = createFailureLog(config.tile);`. A failure the process survives writes one JSON
line on stdout, at most once a second for each `what`, with the fields `level` (`error`), `event`
(`failure`), `tile`, `what`, `error` (the error's name and message, at most 300 characters) and
`upload` or `message` where there is one, for example
`{"level":"error","event":"failure","tile":"watch-api","what":"request GET /modules/watch-cache/:key","error":"TypeError: …"}`.
What writes it, as its `what`:

- a failed request, any answer of 500 or more but 501 (a 501 has its `not-implemented` line):
  `request <method> <route>`, the route's pattern, or `unmatched`;
- a failed sweep, multipart's every 30 s and the asset lifecycle's: `sweep <module>`; and each
  upload a multipart sweep can't finish, at start and every 30 s: `sweep <module>` with `upload`;
- a failed outbox relay, for each row it defers and for a batch that fails: `outbox relay jobs`
  (multipart) and `outbox relay publication` (asset lifecycle);
- a failed or corrupt cache read and a failed cache fill: `cache read <module>`,
  `cache fill <module>`; the cache lost (Valkey unreachable, a command failed or timed out):
  `cache <module>`, or `cache <cache>` for a stub's cache client (its info line when the cache is
  usable, also once at startup, names the `cache` instead of a `module`);
- the broker lost by a publisher or a consumer (a closed connection or channel, a cancelled
  subscription, a failed republish or ack): `broker publish <id>`, the topic's exchange or the
  work queue, and `broker consume <queue>`. When it is back, an info line on stdout:
  `{"level":"info","event":"broker",…,"state":"available"}` (`tile`, `what`, `state`), also once
  at startup;
- a failed multipart start and a failed provider abort after it: `multipart start <module>`,
  `multipart abort <module>`, each with `upload`;
- a Video HLS failure report that can't be built: `failure report <module>`, with `message` (the
  job's message ID).

The answers, retries and what is kept stay as they were. `runProcess` (`process.ts`) also writes
three lines on stderr, each `{"level":"error","event":…,"error":…}` in the same form:
`startup-failed` when startup throws (before `Application startup failed`), `process-failed` when
the process fails with an error (the media worker's own `onFatal`), and `drain-failed` for each drain that
throws while stopping (the process then exits 1).

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
| Database | The database and its setup-only owner (`migrate.mjs`), and a runtime login `r_<db>__<tile>` with CONNECT and USAGE on `public`, exact declared product-table operations and named `published` views (below). Template mechanisms contribute their own private grants; a mutating stub may use `jeeves.idempotency_records` (Module clients, below). Read only of another owner's database: also SELECT on every view its templates contribute (for example `counter_sum_public.totals`). |
| Queue | The broker; a topic's exchange or a work queue, and `<topic>--<tile>` for a consuming tile, each with `.failed` (`broker-init.mjs`); the broker credential |
| Queue saved on Google Cloud, only stubs using it | A Pub/Sub topic with the queue's ID; for each loop stub that consumes it its own subscription `<topic>--<tile>--<module>`, which its tile's copies share (ack deadline 60 s, retries backing off 1–10 s, dead-letter topic `<subscription>.failed` after 100 attempts), and a pull subscription `<subscription>.failed`; locally the emulator `local-pubsub` and `setup-pubsub` (`pubsub-init.mjs`), no credential |
| Cache | `cache-<id>` (Valkey) and its password |
| Object storage | Garage, the bucket (a website when saved public) and the tile's key `s3-<tile>` with read, write or both (`bootstrap.mjs`) |
| Search index | `search-<id>` (OpenSearch), with no index: a module's own mapping is custom work (an Index writer's process asserts its own index, above) |
| External API (QG20) | Nothing runs: the stub gets `externalTarget`, an HTTP client at `JEEVES_EXTERNAL_<ID>_URL`, which the application sets (in `compose.override.yaml` locally; `compose.yaml` sets none) |
| Identity a sign-in binds (QG20) | Its Keycloak, as the sign-in's: the stub gets `identityTarget`, an HTTP client at `JEEVES_IDENTITY_<ID>_URL`, the Identity's base URL as the process reaches it, which `compose.yaml` sets to Keycloak's address inside the network, `http://identity-<id>:8080` (not the sign-in's `OIDC_ISSUER`, the browser's address, which a container can't reach; QGR2), with no `depends_on` of its own: a lost connection is waited out |

Each process gets its credentials, `depends_on` its providers healthy, and has the endpoints it
reads set to these local services in its Compose `environment` (Module clients, below). A store whose saved
provider isn't unspecified or self-hosted, or whose engine isn't unspecified or the local one
(PostgreSQL, Redis-compatible, OpenSearch), isn't provisioned: a required `unsupported` gap
`provider-<module>-<tile>`, so the stack isn't runnable. The exception is a queue saved on Google
Cloud that no template binds (`generationTemplateQueues`, `stubPubsub`): it is a Pub/Sub topic,
below, with its own subscription for each loop stub that consumes it. A queue a
template binds keeps the template's self-hosted provider, and a stub's link to one saved on Google
Cloud keeps the gap. An Identity is provisioned for stubs only when a sign-in binds it (an Auth
guard connected to it is a sign-in template, the tile's only one); a stub's link to an Identity
no sign-in binds, and a link that verifies a token (a `TokenVerifier`, such as an Auth guard on
an External API), stay `unavailable`, and CDN tiles aren't provisioned. An External API isn't a
store and runs nothing; its stub's client only reads its URL. Neither has a gap. Each of the two
has a `stores` row in the report (`kind` `external-api` or `identity`, `access` `request`) whose
`provisioned` names the variable it reads.

**Keycloak** comes from every guard selection (and from a tile-level multipart, as in v2): each
binds its Identity, which runs as `identity-<id>` with one realm `<id>` and one public PKCE client
`<id>-web` whose redirect is the edge origin `/`, written once at setup (`setup.mjs`), with the
admin and database passwords generated into `.runtime/secrets`. Each guarded process gets
`OIDC_ISSUER`, `OIDC_AUDIENCE` (`<id>-web`, the audience of that client's tokens) and
`OIDC_JWKS_URL`, and `depends_on` Keycloak healthy; a deployment sets its own issuer's values.
One Identity per design.

**Product tables and published views.** With Runnable processes on, database-writing modules
contribute application-owned SQL files `infra/postgres/<database>/modules/<module>.sql`. A module
in declared owner-scoped product state keeps its SQL file when its runtime grants become read-only
or empty. Each file is a `generated-extension`: export never rewrites handwritten SQL.

Use `shareOwner {worker, api}` (the worker inspector's **Share logical owner with API**) to choose
shared logical ownership explicitly. Different process IDs keep different runtime logins and
secrets. Conflicting owned state refuses the whole command/connection. These normal controls and
commands require a module-authored design; historical study/preset declarations remain readable.

`setDatabaseAccess {role, database, product: {tables: [{name, operations}], views: [name]}}` declares
SELECT/INSERT/UPDATE/DELETE on exact product tables and SELECT on exact named views in `published`.
Private product tables require the resource's logical owner. Foreign readers receive only named
published views. Table/view names are bounded SQL identifiers; missing relations and the wrong
relation kinds fail setup. No product declaration can name a template implementation schema.
Generated template mechanisms retain their separately checked private grants, including the exact
idempotency-record grant needed by a mutating stub; that never gives SELECT on its product tables.

A source resource's stable `productNamespace: owner` declaration selects `p_<logical owner ID>`
(with SQL normalization). It is persisted when private-table authoring or explicit worker sharing
selects owner-scoped state. Clearing/regranting permissions never changes it. A views-only reader
edit leaves legacy `m_<module>` schemas in place. The final composed identifier must fit 63 bytes,
and private-template namespace collisions refuse even without writer files. Display renames
preserve these identities and cannot fix an identity collision.

`infra/local.json` records each database's product owner/schema, exact role audiences and module
SQL files. Inside the setup-only owner's transaction, `scripts/products.mjs` creates every needed
schema before any module SQL runs, then runs files in stable module-ID order with the declared
schema as `search_path`. It revokes old blanket/default product grants before granting exact
relations. New tables/views grant nothing by default; there are no implicit sequence grants.
Application logins receive no CREATE, schema/database ownership or migration credential. Reports
and SQL-file headers describe the actual product permissions, separately from template grants.

**Product SQL still runs at every `first-run` and `start`.** Keep it re-runnable, without BEGIN or
COMMIT; failure rolls back the database setup transaction and names the file. Versioned product
migrations and registered public SQL execution are not installed yet. Product SQL runs with setup
authority today; the product grant declarations are not a sandbox for arbitrary migration SQL.
The checked extension API exposes no raw SQL/transaction handle to application hooks.

API v6 requires explicit extension migration from older exports. Introducing or changing an
existing product SQL namespace refuses even at the same API version, with no acknowledgement
bypass. Export to a fresh directory and migrate application/data explicitly; never rewrite old
product SQL or hook bodies to make an update pass. Historical exports remain unchanged.

**Module clients (private implementation).** The scaffold `src/runtime/module-clients.ts` holds
the internal adapters described below. The public extension API supplies bounded cache/object/
queue/search/module handles; raw SQL, transaction, token and HTTP target APIs described here
are not passed to product code and remain explicit custom gaps. Physical clients use the same
per-process registry as template clients, keyed by complete configuration and credential identity;
different logins, endpoints or configuration do not share a client. Physical cleanup runs once.
The private adapters implement the internal interfaces in `src/modules/dependencies.ts`, keeping only the sections a design uses:
`databaseClient` (a pool on the tile's login, pool size 10 and 2 s statements, `query` and
`execute`; a query that gets no reply in 2.5 s, as when PostgreSQL stalls, rejects `Query read
timeout` and the pool discards its connection, and a template's pool has the same bound, 500 ms
past its statement timeout; and `transaction(fn)` (QL03), which runs `fn`'s statements on one
reserved connection between BEGIN and COMMIT through `src/runtime/transaction.ts`, which the
primitives emit when no durable template already does: ROLLBACK when `fn` throws or a statement
fails, SQL that starts with transaction control (`BEGIN`, `START TRANSACTION`, `COMMIT`, `END`,
`ROLLBACK`, `ABORT`, `SAVEPOINT`, `RELEASE`, `PREPARE TRANSACTION`) refused before it is sent, a
serialization failure or deadlock (`40001`, `40P01`) rerunning `fn` on a new transaction after
20 ms and then 40 ms, the third rethrown, and a COMMIT that lost its connection after `fn`
resolved (SQLSTATE class `08`, `57P01`, `57P02` or none) rejecting `TransactionOutcomeUnknown`,
never the result; the pool's statement and query timeouts apply inside it; and `idempotent`,
below), `queuePublisher` (publisher confirms; each message gets the module's `messageId` when it
names one, as a deduplicating consumer such as the event counter needs, else a fresh ID; it
reconnects every 5 s after a lost broker),
`pubsubPublisher` (a Pub/Sub topic's publisher on the official client, `@google-cloud/pubsub`
6.3.2, below), `pubsubLoop` (a loop stub's transport on its own Pub/Sub subscription, below), `cacheClient` (`get`, `set` with a TTL in seconds or none, `delete`, through the cache read's
bounded client, `createValkeyCache` in `src/runtime/valkey.ts`, which the primitives emit when no
cache read already does: a command settles within 150 ms and at most 32 wait, while no client is
connected a command fails at once with `Cache unavailable`, a lost or stalled client is destroyed
and a new one tried every 5 s, and the drain destroys the client, so it never waits on the
cache), `objectClient`
(`get`, `undefined` for a missing key, and `put`), `searchClient` (`search`, `index`, `remove`),
`httpTarget` (another tile's process at `JEEVES_TILE_<ID>_URL`, with no probe or `depends_on`),
`externalTarget` (an External API at `JEEVES_EXTERNAL_<ID>_URL`) and `identityTarget` (the Identity
a sign-in binds, at `JEEVES_IDENTITY_<ID>_URL`: locally Keycloak inside the network, so a stub adds
the realm's paths, `/realms/<id>/...`; a deployment sets its issuer's origin or another address its
processes reach) (QG20). The three HTTP clients have no probe; each resolves a
stub's `request(path, init)` against its base URL and passes `init` to `fetch` as it is, so the
stub bounds a call with `signal: AbortSignal.timeout(ms)` and adds its own headers (a credential
it reads from a `SECRET_DIR` file: the client reads none). `httpTarget` and `identityTarget` mark a
rejected `fetch` `Symbol.for("jeeves.internal-call")`, so a loop waits out a lost connection to a
provisioned service as it does a store's; `externalTarget` doesn't, so an outside call keeps the
normal retries. Each other
client runs one bounded startup probe its access allows (5 s): `SELECT 1`, opening the broker and a
confirm channel, the Pub/Sub topic existing (for a loop, its subscription), `PING`, `HeadBucket` (or, for a write-only key,
opening and aborting a multipart upload) and cluster health. Each logs one JSON line
(`{"event":"probe","tile","client","kind","check","result":"ok"}`); a failure logs the error and
fails startup, so a healthy process has reached every store it uses with its own credentials. A
cache is the exception: one that is down at startup logs `"level":"warn"` with
`"result":"unavailable"` (the error is in its `cache <cache>` failure line), and the process
starts without it; its client connects by itself when the cache is back. After its
configuration pass (below), the process file builds one client per store before its loops
subscribe and its service listens, then
each stub's `dependencies["<module>"]`, named as in its `.slots.ts`. A module link calls the module
it names (a route stub with the caller's input as its request, a library stub with none). What isn't
provisioned (another provider, an Identity no sign-in binds, a link that verifies a token, a CDN, a
tile with no process, a template's part) is `unavailable(...)`: every call answers "Not
implemented: <tile> for <module> (<why>)". A stub's own "Not implemented" still answers 501 or goes
to `.failed`.

**Idempotency records** (QL04, owner decision D4). On each database a stub writes, the export has
Jeeves's own table `jeeves.idempotency_records` (`tile`, `scope_kind`, `scope_id`, `idem_key`,
`request_hash` bytea, `status`, `response` jsonb, `created_at`, `expires_at`; primary key the
first four, an index on `expires_at`), created by the migration
`infra/postgres/<database id>/050-jeeves-idempotency.sql` (`idempotencyMigration` in
`client-wiring.ts`, a `generated-scaffold`, applied once before any `100-` template migration and
the product SQL) as the setup-only owner, with no PUBLIC access. Only the logins of the tiles whose
stubs write that database get USAGE on `jeeves` and SELECT, INSERT, UPDATE and DELETE on it
(`grants` in `infra/local.json`); a database a stub only reads gets neither, and a stub never
creates it. A database several tiles' stubs write gets the migration once and a grant for each.
A stub's `db.idempotent({ scope, key, hash }, fn)` (`src/runtime/idempotency.ts`, which the
primitives emit with the database client) makes a create or payment request idempotent: `scope`
is `{ kind, id }` (`kind` `^[a-z][a-z0-9-]{0,31}$`, `id` 1–255 characters) and `key` 1–255
visible ASCII characters (`[\x21-\x7e]`), else `Invalid idempotency key` before any statement;
`hash` is `requestHash({ method, route, params?, body? })`, SHA-256 over the canonical request (the
method upper-cased, params and every object's keys sorted, arrays in order, no body `null`). In one
`transaction` it deletes the key's expired record, inserts one (status 0, 24 hours) unless the key
has one (a concurrent holder on another copy keeps it waiting on the primary key), runs `fn(tx)`,
and stores a 200–299 answer before COMMIT; any other status rolls `fn`'s writes back and is
returned with `replayed: false`, not stored. A key with a record answers its stored status and body
with `replayed: true` without running `fn`, or for a different hash rejects `IdempotencyConflict`
(`name` `"IdempotencyConflict"`, which the stub answers 409) after ROLLBACK. The first call starts
the sweep (`sweepExpired`): then and every 60 s, under
`pg_try_advisory_lock(hashtext('jeeves.idempotency'))`, it deletes at most 1,000 expired records
(any tile's), and a copy without the lock does nothing; a failure logs an
`idempotency sweep <tile>` failure line; the sweep is owned by the process's scope and stops at
drain. The values are the generation catalog's `idempotency-policy`. Loop stubs may call it too.

**Settings a stub declares.** A product operation module exports
`settings = declareSettings({ NAME: kind, ... })` from `src/extension-api/index.ts`.
Names match `^[A-Z][A-Z0-9_]{0,63}$`, excluding `JEEVES_*`, `OIDC_*`, `PG*`,
`SECRET_DIR` and `PORT`. Public kinds are `text({ max? })`, `integer({ min?, max? })`,
`url({ protocols? })`, `signingKeys(purpose)`, `sealingKeys(purpose)` and `optional(kind)`.
Text/integer/URL values come from the environment. Configuration validates all declarations
before any client opens, reads each ring file once per process, and passes the same frozen
values as `dependencies.settings`. Missing/invalid values name only `Invalid setting <NAME>`.
Only built-in descriptors and `optional` descriptors derived from them are accepted. Structural
copies and custom parse callbacks refuse before file access. The report lists declaration files;
Compose does not supply application-owned settings.

Signing/sealing settings read `JEEVES_SECRET_<NAME>_FILE` (an absolute path) or
`SECRET_DIR/<name>` (default `/run/secrets`, lower case with `_` replaced by `-`). Supply a JSON
array of 1–8 unique `{ "id", "key" }` entries; IDs are 1–32 `[A-Za-z0-9_-]`, keys are
high-entropy canonical unpadded base64url of 32–4096 bytes, and the file is at most 64 KiB.
The first key writes; retained keys read. Rotate the file and restart each replica. Raw rings,
secret bytes and file readers are private; product policies receive no handle.

`signingKeys("cursor.items")` yields only `sign(value, {scope, context})` and
`verify(envelope, {scope, context})`; `sealingKeys("private.receipt")` yields only `seal/open`.
The purpose is fixed at declaration, 1–64 `[a-z][a-z0-9.-]*`; `jeeves` and the `jeeves.`
prefix are reserved for private generated mechanisms. Supply trusted account/tenant
scope and operation context, each nonempty and at most 512 UTF-8 bytes. Values are UTF-8 strings
up to 16 KiB, envelopes up to 24 KiB. Invalid writes throw a value-free error; invalid reads
return `undefined` without logging. Verification does not supply expiry, authorization or
product-schema checks. Node HKDF-SHA256 separates purpose and mode keys; HMAC-SHA256 and
AES-256-GCM authenticate structured version/key/purpose/scope/context fields. Sealing uses
random 96-bit nonces and 128-bit tags. Canonical base64url refuses padding/aliases. Removed or
unknown keys, changed contexts and corrupt envelopes refuse. See `.jeeves/extensions.md`.
These are reusable primitives; replay, workload identity, webhook ingress and sessions are
not added by declaring a handle.

**Endpoints from the environment.** A process with stubs checks every variable its stubs' clients
and its sign-in read, and its stubs' declared settings (QL05), in one pass, `checkConfiguration`
at the top of its process file, before any client is built or probed (QG31); each client reads its own again as it is built; a template's own
clients read theirs as each is built. No variable has a default (`<ID>` is the tile ID upper-cased,
`-` as `_`, so `hot-routes` is `HOT_ROUTES`):

| Endpoint | Variables | Local value in `compose.yaml` |
| --- | --- | --- |
| A Database tile | `JEEVES_DATABASE_<ID>_HOST`, `JEEVES_DATABASE_<ID>_PORT`, `JEEVES_DATABASE_<ID>_TLS` | `local-postgres`, `5432`, `disable` |
| A Cache tile | `JEEVES_CACHE_<ID>_HOST`, `JEEVES_CACHE_<ID>_PORT`, `JEEVES_CACHE_<ID>_TLS` | `cache-<id>`, `6379`, `disable` |
| The broker | `JEEVES_BROKER_HOST`, `JEEVES_BROKER_PORT` | `local-broker`, `5672` |
| Another application tile a stub calls | `JEEVES_TILE_<ID>_URL` | `http://app-<id>:3000` |
| An External API a stub calls (QG20) | `JEEVES_EXTERNAL_<ID>_URL` | None: the application sets it (`compose.override.yaml`), and until then startup fails `Invalid endpoint JEEVES_EXTERNAL_<ID>_URL` |
| The Identity a stub calls, when a sign-in binds it (QG20) | `JEEVES_IDENTITY_<ID>_URL` | Keycloak inside the network, `http://identity-<id>:8080`: the Identity as the process reaches it, not the sign-in's `OIDC_ISSUER`, which a container can't reach (QGR2); a deployment sets its issuer's origin or another address its processes reach |
| Pub/Sub, for a process that publishes to or consumes a topic | `JEEVES_PUBSUB_PROJECT` (and only locally `PUBSUB_EMULATOR_HOST` and `METADATA_SERVER_DETECTION`) | `local`, `local-pubsub:8085`, `none` |

A host is 1–253 letters, digits, `.` or `-`, or for a database an absolute path (a Unix socket
directory, as `pg` reads it, such as Cloud SQL's `/cloudsql/<instance>`); a port is an integer
1–65535; a URL is absolute `http:` or `https:` with no credentials, query, fragment or whitespace
(which URL parsing would trim, so a trailing newline fails too); a Pub/Sub
project is a Google Cloud project ID (a lowercase letter, then up to 29 lowercase letters, digits
or `-`, optionally after `<domain>:`). A missing or invalid one fails startup with `Invalid endpoint <variable>`, never its value, in the
`startup-failed` line; several fail together as `Invalid configuration: <message>; <message>`
(each message once, in the pass's order: the clients' sorted keys, the broker and Pub/Sub for the
loops, their credentials, the sign-in, then each stub's declared settings, QL05). The stubs' clients read theirs in `module-clients.ts` (the pass calls
`databaseEndpoint`, `cacheClientEndpoint`, `brokerBinding`, `pubsubProjectId` and the HTTP clients'
own calls; object storage and search are compiled, so they have none); a template's `pool`
and `brokerBinding` (its publisher, consumer and loop) in `service-resources.ts`; the cache read
its cache through `cacheEndpoint` in `valkey.ts`, whose bounded client checks a host by the same
rule. Every RabbitMQ loop passes `brokerBinding()` to `startModuleLoop` or `loopConsumer`, and a
Pub/Sub loop passes `pubsubLoop(probe)`: `tile-loop.ts` compiles no broker endpoint, so each loop
takes its transport from its process. The foundation sets exactly the
variables each process reads in its `app-<id>` service's `environment` (`localEndpoints` in
`local-contract.ts`, a stub Identity client's `JEEVES_IDENTITY_<ID>_URL` among them), beside a
sign-in's `OIDC_*`. The one it doesn't set is an External API's `JEEVES_EXTERNAL_<ID>_URL`, the
application's to set (QG20). `processes.tiles[].environment` in the report lists every variable
a process reads, sorted, that one included, and the export's README lists the same per process
(QG26); the API's `stores` row names it too. A deployment sets its own values; local stacks
behave as before. Object storage and search are still reached at their local
names (`local-objects`, `search-<id>`), and the setup scripts keep their own (`migrate.mjs` reads
`PGHOST`, `PGPORT` and `JEEVES_MIGRATE_TLS`).

**Verified TLS bindings** (QG10). A database's or cache's `_TLS` is `disable` or `verify-full`,
with no default. `disable` is plain text: `createPostgres` (`postgres.ts`) gives `pg` `ssl: false`,
so `PGSSLMODE` can't change it, and the cache's socket has no TLS. `verify-full` is TLS that checks
the certificate chain and the host name: `pg` gets `{ rejectUnauthorized: true }` and
`createValkeyCache` connects with `socket.tls` and `rejectUnauthorized: true`. With `verify-full`
two variables are optional: `_CA_FILE`, a PEM file read as the client is built (`ca`; else Node's
roots), and `_TLS_SERVERNAME`, the name the certificate must carry when it isn't the host (a
managed instance reached by a private address; a host name by the host rule). For `pg`, which puts
a host name in place of `servername`, that name is checked by the pool's own
`checkServerIdentity`. No value turns verification off. A CA file that can't be read fails startup
with `Unreadable CA file <variable>` and its error code (`ENOENT`, `EACCES`, `EISDIR`), never its
path; `_CA_FILE` and `_TLS_SERVERNAME` are not read with `disable`. `JEEVES_REQUIRE_TLS` is `true`
or unset (another value fails with `Invalid endpoint JEEVES_REQUIRE_TLS`); with `true`, startup
fails with `Insecure endpoint <variable>` for a database or cache whose `_TLS` isn't
`verify-full` (a database's Unix socket directory is local transport and passes), a
`JEEVES_TILE_<ID>_URL`, `JEEVES_EXTERNAL_<ID>_URL` or `JEEVES_IDENTITY_<ID>_URL` that isn't
`https:` (`httpTarget`, `externalTarget`, `identityTarget`), an `OIDC_ISSUER` or `OIDC_JWKS_URL`
that isn't `https:` (`signInSettings` in `tile-guard.ts`) and any `PUBSUB_EMULATOR_HOST` (both Pub/Sub
clients). Each is checked where its client is built: the stubs' in `module-clients.ts` (and first in
the configuration pass, with the sign-in's), a template's pool in `service-resources.ts`, the cache
read's cache in `cacheEndpoint`. The broker (RabbitMQ),
object storage and search have no TLS and are not checked. `migrate.mjs` reads its own
transport, `JEEVES_MIGRATE_TLS`, by the same rules, the switch's included (QG29, below). With the
switch, `NODE_TLS_REJECT_UNAUTHORIZED` must be unset or `1`, else startup
fails with `Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED`: `0` would turn off certificate checks
for every client that leaves them to Node (QG30). `compose.yaml` sets `disable` for every database
and cache and never `JEEVES_REQUIRE_TLS`, so local stacks are unchanged.

**Pub/Sub channels for stubs** (QG07). With Runnable processes on, a Queue tile whose every user
is a stub has the normal control Provider (`queue.provider`: unspecified, self-hosted or
google-cloud; [studio settings](../docs/studio-settings.md)). Saved on Google Cloud, it is a Pub/Sub
topic named by the tile's ID (`StubStore.pubsub`, a `pubsub` resource in `infra/local.json`, never
the broker's), and a design whose only channels are Pub/Sub ones has no `local-broker`. Each stub
that publishes to it gets `pubsubPublisher`: `publish(message, { messageId })` calls
`topic.publishMessage({ data, attributes: { messageId } })` with the module's `messageId` (else a
fresh UUID) and resolves only once Pub/Sub has acknowledged it, so a consumer deduplicates on the
attribute (Pub/Sub gives a resent message a new server ID). A publish settles within 2000 ms: the
client's `gaxOpts.timeout` is 2000 and the publisher rejects `Publish deadline (2000 ms)` itself,
since the client's default waits far longer for an unreachable service. At most 1000 are outstanding
per process; the next rejects at once, `Publisher queue full`. The client's default batching
applies, and `key` is not used. Its probe checks `topic.exists()`; false or an error fails startup.
The drain waits for outstanding publishes, then closes the client. Every Pub/Sub client in the
templates (the publisher's, a loop's and `pubsub-init.mjs`'s) is built with the gRPC options
`grpc.initial_reconnect_backoff_ms` 500 and `grpc.max_reconnect_backoff_ms` 2000 (`pubsubChannel`;
gRPC's own maximum is 120 s), so its channel tries a lost connection again within 2 s. Locally each
service that publishes to or consumes a topic also gets `METADATA_SERVER_DETECTION: none`, so its
client looks for no Google metadata server (the lookup took about 3 s of the 5 s probe); no
`universeDomain` is passed, since it takes the client out of emulator mode. It runs in
`JEEVES_PUBSUB_PROJECT` with Application Default Credentials (the export holds no key file), and
needs `pubsub.topics.get` and `pubsub.topics.publish` on the topic. Processes never create or change
topics or subscriptions: locally only `setup-pubsub` does, running `scripts/pubsub-init.mjs` at
`first-run` and every `start` (`local.mjs` runs it after the providers, with `setup-broker` and
`setup-search`, before the processes), because Pub/Sub keeps a message only for subscriptions that
exist when it is published and the emulator keeps nothing across a restart. It creates each topic
and subscription the plan lists that is missing, and stops at one that exists with other settings,
naming it. `local-pubsub` is the emulator (`gcloud beta emulators pubsub start
--host-port=0.0.0.0:8085 --project=local`, pinned in `providers.json`), healthy once it answers on
8085, with no published port. The report's store row says `Google Cloud Pub/Sub topic <id> (locally
the emulator local-pubsub)`, or for a consuming tile each of its loop stubs' subscriptions, and the export's README says
what a deployment's own infrastructure creates and grants (the Pub/Sub service agent's rights a
dead-letter policy needs).

**Pub/Sub loops** (QG08). A loop stub on such a topic consumes its own subscription
`<topic>--<tile>--<module>` (QG28), which its tile's copies share, through `pubsubLoop(probe)` in
`module-clients.ts` (the `pubsub-loop` section, beside the publisher's `pubsub`), with a RabbitMQ
loop's contract. Its process config's loop row names the subscription and
`<subscription>.failed`, and its service gets `JEEVES_PUBSUB_PROJECT`
(and locally `PUBSUB_EMULATOR_HOST` and `METADATA_SERVER_DETECTION`), not the broker. At start it checks the subscription exists
(5 s; false or an error fails startup), then opens one streaming-pull subscriber with flow control
`maxMessages` equal to the loop's Concurrency and `allowExcessMessages: false`, so at most that
many messages are in hand; the client extends a message's lease while it is, and with
`minAckDeadline` 60 s (the subscription's own ack deadline, which the client's 10 s start would
otherwise shorten) it renews the lease at most about 54 s apart, so a message held through store
waits keeps its lease and its attempt. The trade-off: a consumer that crashes holding a message
gives it back only when that lease ends, so Pub/Sub delivers it again up to 60 s later instead of
about 10 s (the pubsub suite's P4 measures it). Each message gives
the stub `body` (its data), `messageId` (its `messageId` attribute, else Pub/Sub's ID), `headers`
(its attributes), `attempt` (Pub/Sub's delivery attempt, which counts from 1 because the
subscription has a dead-letter policy) and `source` (the subscription). It is acknowledged only
after the stub resolves. Another error is nacked at once and the subscription's retry policy (1–10
s) spaces the redelivery; a failure on delivery attempt retry limit + 1 (6 for a stub), a
`NonRetryable` or "Not implemented" publishes a copy to the `.failed` topic with the message's
attributes and `x-terminal-code` (`RETRY_EXHAUSTED`, its code, `NOT_IMPLEMENTED`), and the message
is acknowledged once Pub/Sub has the copy (within 2000 ms), else nacked. An unreachable store
(`unreachable`, as above) keeps the message: the stub runs again 5 s later with the same message
and attempt, and a drain during the wait nacks it. A subscriber error logs one `broker consume
<subscription>` failure line (so does a failed `.failed` copy), and `"state":"available"` when a
message arrives again; a subscriber that closes on an error opens again 5 s later, once its
messages in hand have settled and the subscription answers, and the process never stops for it.
The drain stops taking messages, lets those in hand settle, then closes the subscription (which
nacks what it held back) and the client. Pub/Sub counts every redelivery as an attempt, a nack at
a drain or a lost lease too, where RabbitMQ's `x-delivery-attempt` counts only the loop's own
retries. A consuming process needs `pubsub.subscriptions.get` and `pubsub.subscriptions.consume`
on its subscription and `pubsub.topics.publish` on its `.failed` topic. Every loop stub has its
own subscription, whether its tile has one or several on the topic, so each gets every message in
either mode: in work-queue mode two loop stubs of one tile each get every message on Pub/Sub, where
RabbitMQ's share the work queue. The name never depends on how many modules consume, so adding a
loop stub never renames another's subscription.

**Credentials** are generated at first run, as for templates: `setup.mjs` writes the
passwords, and `bootstrap.mjs` the Garage keys, into private `.runtime/secrets` (0700). None is
in the export or the repository. `pnpm stop` and `pnpm start` keep them and the volumes. A
process (`readSecret` in `local.ts`) and the setup scripts (`secret` in `common.mjs`) read a
credential from the file `JEEVES_SECRET_<NAME>_FILE` names when that is set, else from
`SECRET_DIR/<name>` (`/run/secrets/<name>`, where Compose mounts it) (QG34). `<NAME>` is the
secret's name upper-cased, with `-` and `.` as `_` (`sql-links--redirect-service` is
`JEEVES_SECRET_SQL_LINKS__REDIRECT_SERVICE_FILE`), and the value is an absolute path, so a
platform that mounts each secret at its own path (Cloud Run) needs no wrapper. A value that isn't
absolute, or holds a control character, fails `Invalid endpoint <variable>`; a file that can't be
read fails `Unreadable secret file <variable>` with its error code (`ENOENT`, `EACCES`), never the
path or the value. `readSecret` checks the name first (`Invalid secret identity`). A process with
stubs also reads, in its configuration pass, each credential its stubs' clients read, the names
Compose's `secrets` gives its service (`sql-<database>--<tile>`, `cache-<id>`, `broker-password`,
`s3-<tile>`), sorted, after the endpoints and before the sign-in, and discards the values (QG35):
a credential that can't be read fails before any probe, named with any other wrong setting. A
template's own clients read theirs as each is built. Compose sets
none of these variables, and they are optional, like `_CA_FILE`, so neither the report's
`environment` nor the export's README lists them per process; the README's intro gives the rule.

Each mounted lead gets `src/modules/<host>/<lead>.hooks.ts` (a `generated-extension`): one
factory over its bounded public inputs whose every hook throws `NotImplemented("<hook>
for <lead name>")`. The multipart's are `validate`, `metadata`, `response`, `originalKey` and
`job`, plus `reserve`, `complete` and `closed` when no asset lifecycle names the upload
(`principal` is the sign-in's); the cache reader's `key`, `codec`,
`eligible`, `load` and `expiresAt`; the lifecycle's `metadata`, `event`, `result`, `failure`,
`job.codec`, `job.construct`, `response`, `publication.codec`/`construct` and the three
`identities`; the video's codecs (`job`, `video`, `result`, `eventId`, `event`) and the source and
results `owns`; the counter's `event`, `aggregateKey`, `eventId` and `identity`; Favorites'
`eligible`; the Index writer's `mapping`, `document.parse`, `document.id`, `document.version` and
`event` (`<Lead>Document` is its document type); the Search query's `preset` and `hit`. No hook
names a product: the mapping, documents, events and query preset are product data the hooks
return. The process wraps
the hooks so a loop's log names the hook a message reached. Its `*-application-bindings` gap
becomes a required `custom` gap naming that file (search's names both); an index an Index writer
asserts needs no contributed mapping, so no `search-mappings` gap. The scaffold
`src/runtime/tile-process.ts` holds `NotImplemented`, the rate-limited log and the `started`
line, and `tile-http.ts` the 501 wrapper: an error that is a `NotImplemented` or whose message
starts with "Not implemented" answers 501
`{"error":"NOT_IMPLEMENTED","message":"Not implemented."}` and logs one JSON line
(`level`, `event: "not-implemented"`, `tile`, `module`, `what`, `route`, `action`) at most once a
second per module with the fixed `handler` label, the next line carrying a `suppressed` count. An `HttpError` keeps its
status and anything else answers the existing 503. Fill a stub in its `<module>.ts` and a
template in its `.hooks.ts`; no scaffold changes.

With the option on, the manifest records `"processes": true` beside `runtime`, and the report
gains `processes`: `runnable` (no findings, no `unsupported` gap and a service for every
application tile; `applicationComplete` keeps its meaning) and `tiles`, each with its service,
shape, exposure, edge path, entry point, settings with their origin (`template`, `tile` or
`fixed`: an HTTP process's Request timeout and Concurrency limit, a worker's Concurrency), routes
and loops (each with what it answers), templates (`mounted` or `placeholder`), hooks files and
`stores` (each store or channel its stubs use, the access, the modules, and what is `provisioned`
for it or why it is `unsupported`), and `delivery` (each CDN tile's route). With it off, nothing
changes: `processes-off.test.ts` pins the export of frozen v2, the v2 module design with its
values and the stub stack (`spec/src/fixtures/stub-stack.ts`) as they were before the option
existed, every payload byte and the provenance files apart from their source and emitter
inventory.

To run one, export it into a new directory, then, in it, `pnpm install --frozen-lockfile` and
`pnpm build`; allocate the project and ports as below and run
`pnpm first-run`. Each `app-*` is healthy once ready. Public processes answer at
`http://127.0.0.1:$LOCAL_HTTP_PORT/api/<id>/`, for example `/api/<id>/healthz` or
`/api/<id>/modules/<module id>`; reach an internal one from inside the network, for example
`docker compose --profile '*' exec app-<id> node -e
"fetch('http://app-<other>:3000/healthz').then(r=>r.text()).then(console.log)"`. A loop's log
lines are in `docker compose --profile '*' logs app-<id>`, and `docker compose --profile '*' exec
local-broker rabbitmqctl list_queues name messages consumers` shows each queue's consumer and
what reached `.failed`. A process's probe lines are in its log too. `pnpm stop` drains every
process (exit 0) and `pnpm start` brings them back healthy, with the `.failed` messages,
credentials and volumes kept. The generated scripts never pass `-f`, `--file` or
`--project-directory` and never set `COMPOSE_FILE`, so Docker Compose merges the application's own
`compose.override.yaml` into every call (`local.test.ts` keeps it so). The composition hash covers
only `compose.yaml` and `infra/local.json`, so an edited override never refuses `start` and applies
at the next one.

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

`loadLocalV2Registry()` installs the local runtime foundation (standalone package, lock and build files, pinned providers, setup and restart wiring), the nine templates, module stubs and tile processes. No process runs unless [Runnable processes](#runnable-processes) is on. The studio's Generate project dialog previews and downloads this export ([above](#jeeves-preview-and-zip-download)).

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
and HTTP response mapping; no private SQL login or complete application is installed. With
Runnable processes on, the search mounts above construct the services and take the codecs,
mapping, preset and hits from hooks files. See the
[search interfaces and limits](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-14--public-search-projection-and-bounded-query).

Trusted feature registration can pass `V2Emitter[]` to `loadLocalV2Registry(features)`.
`V2Emitter.local(context)` returns the finite `V2LocalContribution` hooks for migrations,
runtime logins, schema-qualified views/relation grants, topic subscribers, storage access/CORS,
versioned search mappings and runnable services. The foundation owns each shared file once and
records only its actual contributors; static utility assets do not credit unrelated features.
See the [actual interface record](../docs/plans/reliable-foundations/youtube-v2/interfaces.md#yv2-04--standalone-local-foundation).

Exports use Node 24.21.0/pnpm 12.16.1 and the captured exact v1 dependency/provider pins.
Rendering never reads mutable v1 files. Install with `pnpm install --frozen-lockfile` and build
with `pnpm build` in the export. The `Dockerfile` builds as root, then its `app` image
(every process and setup container) and `media` image run as the base image's unprivileged `node`
user (uid 1000). `/app` stays root-owned and readable, so at run time a process writes only under
`/tmp` (its ready marker, the media worker's job files), and setup writes every secret those
containers mount with mode 0644, set after the write so the host's umask can't narrow it. Allocate `COMPOSE_PROJECT_NAME`, `LOCAL_HTTP_PORT`,
`LOCAL_IDENTITY_PORT`, `LOCAL_OBJECT_PORT` together; all three ports must be distinct, free,
loopback ports outside the owner/v1 reservations. Run `pnpm first-run` once, `pnpm stop` for
all profiles and `pnpm start` to retain the exact project, private `.runtime` credentials and
recorded Docker volume identities. Changed/missing identities refuse. Interrupted storage
bootstrap requires manual inspection. Migration hash changes refuse without resetting data.
`scripts/migrate.mjs` holds the advisory lock `local-v2:cluster` on its admin connection from
before the first role until the last database is done, so copies started at once run one at a
time. It reaches PostgreSQL at `PGHOST` and `PGPORT` with `JEEVES_MIGRATE_TLS` (QG29),
`disable` or `verify-full` with no default, read before the first connection as a database's
`_TLS` is: with `verify-full`, `JEEVES_MIGRATE_CA_FILE` is an optional PEM file (one that can't be
read fails `Unreadable CA file JEEVES_MIGRATE_CA_FILE` and its code) and
`JEEVES_MIGRATE_TLS_SERVERNAME` the optional name the certificate carries. Every connection gets
that `ssl`, so `PGSSLMODE` can't change it. With `JEEVES_REQUIRE_TLS=true`, `disable` fails
`Insecure endpoint JEEVES_MIGRATE_TLS` unless `PGHOST` is a socket directory, and QG30's
`NODE_TLS_REJECT_UNAUTHORIZED` rule applies; `compose.yaml` gives `setup-migrate` `disable`. Its
admin may be a superuser or, as on a managed PostgreSQL 16 or later, a CREATEDB
CREATEROLE role: a non-superuser admin grants itself each database owner `WITH INHERIT FALSE, SET
TRUE`, so it can create the owner's database without using the owner's privileges. An owner role
the admin didn't create needs `GRANT <owner> TO <admin> WITH ADMIN OPTION` from its creator first,
else the run stops at `permission denied to grant role` before any database statement. Each
database's `REVOKE ALL … FROM PUBLIC` and `GRANT CONNECT` run as its owner (`SET ROLE`), so
PUBLIC keeps no CONNECT whichever admin runs it, and a non-superuser admin has none of its own.
Owners are setup-only; runtime users require explicit relation grants and published readers
can receive only contributed views. Provider startup is not application readiness.

```
pnpm --filter @jeeves/generator export:v2 /path/to/schema3-design.json /absolute/new-directory
```

The CLI exports this honest partial bundle using the existing `exportNewDirectory`; it refuses
every existing destination, including an empty or edited one, and symlink ancestors. It prints
completeness/findings without claiming the export runs. `planFileWrites` remains available for
pure edit/custom-file preservation checks. V1 continues using `export:new` unchanged.


RG03 adds a runtime-owned operation context to HTTP stub requests and queue messages. It carries
bounded request/correlation identities, verified caller facts, cancellation and remaining duration.
Dependency adapters refuse expired work; receivers clamp forwarded durations to their own maximum.
Each delivery receives a fresh 30-second execution budget. Attributes/identity are bounded and
preserved by both publishers; SDK mutation retries are disabled. Fetch/S3/OpenSearch cancellation
is best effort; drivers that cannot cancel remain tracked until actual settlement or the process's
10-second final drain bound. A timeout or lost COMMIT/publish response can be `unknown`, never proof
of rollback. Unknown queue effects use terminal `OUTCOME_UNKNOWN`, not automatic effect retry;
broker redelivery/crash still requires installed durable recovery. Custom SQL/authenticated target
handles remain unavailable. Private target transport permits only its declared origin, manual
redirects, safe headers and a 64 KiB response. See each export's `.jeeves/extensions.md` for v3
migration and exact attribute bounds. Old exports/hooks are preserved and require explicit migration.


## Generated HTTP contract (extension API v4)

All mounted templates and route stubs use one HTTP classifier and the shared application-owned
`src/http-errors.hooks.ts` body formatter. The formatter is synchronous pure policy, checked
including its helper imports. It receives frozen safe code/message/status/retryability and
request/correlation IDs, never an exception, credential, header or body. Generated code controls
status, `WWW-Authenticate`, `Allow`, `Cache-Control` and retry metadata. Invalid, asynchronous,
throwing or oversized formatter output falls back to `{error, message}`. Returned error bodies
have no trusted provenance and are replaced with generated safe defaults. An explicit internal
`HttpError` marks a safe public message. Not-implemented answers remain distinct 501 responses.

Only a genuine refusal before admission (not accepting or overloaded) advertises
`Retry-After: 1`. Deadlines, unknown effects and generic dependency failures never authorize blind
replay. A token/claim/signature failure answers 401 with `WWW-Authenticate: Bearer`; unavailable
JWKS/native key dependencies answer 503. A framework parser's known validation errors retain
400/413/415 without exposing its exception. A provider's arbitrary `statusCode` is not trusted.

Generated `HttpRoutes` support finite body limits of 1 KiB, 16 KiB, 64 KiB (default) and 1 MiB.
Fastify enforces the selected route bound before buffering beyond it, including streamed bodies.
The request budget starts in `onRequest`, after HTTP headers; a stalled body receives the same
classified deadline response and unread input closes after that response flushes. Dispatch
rechecks expiry before calling any module or template handler.
A generated `rawBody: true` route receives exact bytes as `body` and `rawBody`, including malformed
JSON; decoding is deferred to its handler. Default routes decode JSON/text as before. These are
internal route declarations, with no inspector controls. Webhook authentication/storage is absent.

`/livez` answers 200 while HTTP can respond, including drain. `/readyz` and `/healthz` answer 200
after successful initialization/listen, then 503 during drain. Required failed startup prevents
readiness; these are not continuous deep dependency probes. Health routes bypass product guards
and admission. Safe completion/failure JSON lines contain route patterns (no URL/query), status,
request/correlation IDs and classification. Authorization, Cookie, request/response bodies and
original exceptions are excluded. Quoted unwritten-hook labels in the support report identify
missing implementation; the public 501 body stays generic. Lifecycle milestones identify admission stop, cancellation,
HTTP/process drain completion and the existing ten-second final deadline.

Updates from API v3 require `--ack-extension-api=4` and the staged interface/boundary check. Hooks
are preserved; the shared formatter is added as an application-owned scaffold. Review assumptions
about old provider-detail error bodies and automatic retries. No hook is silently rewritten.

## Product SQL contract (extension API v7)

Runnable exports use application-owned `infra/postgres/<database>/products.json`, ordered
migrations under `products/migrations/<schema>/`, and registered SQL under `products/queries/`
and `products/commands/`. Legacy `modules/*.sql` files are preserved but never executed.
A namespace has one ordered checksum history; add a four-digit version instead of editing an
applied file. Setup locks execution and commits product DDL and its protected ledger together.
Failures roll back both. Real concurrent PostgreSQL migrator evidence belongs to RG14.

The declaration lists `version: 1`, `namespaces` (`schema`, `migrations: [{version, file}]`),
`tables` (`schema`, `name`), `views` (`schema`, published `name`, product view `source`), and
`operations`. Each operation has a stable `name`, `host`, `module`, `kind` (`query` or `command`),
`file`, `parameters` (0–32), and `relations: [{schema, name, operations}]`; relation operations
are lowercase `select`, `insert`, `update`, `delete`. All arrays are bounded at 128 entries.
The declaration can narrow the compiled diagram grants and actual module database links; it
cannot add a dependency or name protected/foreign schemas. Create source views inside the
product namespace; generated setup alone exposes declared views in `published`.

A stub database dependency exposes only `call(name, positionalValues)`, returning copied/frozen
`{rows, rowCount}`. Values are null, strings, finite numbers or booleans; bind them with `$1`
through `$n`. Register one SELECT per query or one INSERT/UPDATE/DELETE per command. Queries
execute in a database READ ONLY transaction, including when the same process can run commands.
The generated transaction owns commit/rollback and keeps its existing unknown-outcome rules.
Policies get no SQL handle. Template loaders without an installed registered binding remain gaps.

Configuration is validated before connections. Product operations use separate exact product
login credentials and pool scopes. Migration SQL runs as a namespace-only NOLOGIN/NOINHERIT role,
with no CREATE on `published`, template-state or ledger authority. Setup owns the ledger and
grant changes; its credential never reaches processes. The lexical checks reject transaction,
role and lifecycle controls; they are not a SQL parser or hostile-code sandbox. PostgreSQL
privileges and READ ONLY enforce the boundary.

For an old export, preserve the application/database and review the actual schema/data first.
Write an explicit initial baseline and subsequent migrations in a fresh export. Perform existing
database baselining/data movement externally; neither the runner nor updater executes legacy SQL
or infers a conversion. A prepared same-namespace update requires the declaration/migration files
and `.jeeves/product-sql-migration.json` with `version: 1`, `mode: "external-reviewed"`, and
`legacy: [{file, sha256}]` for every old module SQL file using its current hash. This records the
application's external review, not database migration proof. Missing or stale material refuses
without changing existing files, even with `--ack-extension-api=7`. Namespace changes still
require a fresh export and explicit application/data migration. The complete generated migration
guide is `.jeeves/extensions.md`; acknowledgement also requires its staged checker/TypeScript build.
