# Experimental generator foundation

The separate v2 API now accepts explicit schema3 generation selections. See
[v2 registry and export](#v2-registry-and-export) for its current diagnostic-only implementation;
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

The canvas **Generate project → Preview scaffold → Download project ZIP** flow uses the explicit
real registry. Only exact canonical saved source (including revision 3) matching snapshot005 is
accepted. Another source is refused; the old frozen app is never silently substituted. An exact
source copy can export, with selected-project identity shown separately from the frozen origin.
The ZIP retains the original frozen provenance unchanged. No strict readiness is upgraded.

Read-only POST routes under `/projects/:id/experimental-generation/preview` and `/download`
accept `{ profileId, baseRevision, sourceSha256 }`; download additionally requires the preview's
`archiveSha256`. Bodies are strict; no output directory, artifact upload or executable selection
is accepted. Preview returns the full partial report plus summary counts, versions, source and
archive hashes. Both recheck the saved source after assembly; stale source/archive returns 409,
unsupported profile/source returns 422, missing project 404, malformed request 400, and
input/PNG or assembly failures inside a request return 503. Templates load eagerly at API module
startup: missing/unreadable template files can prevent startup and must be repaired before the
routes become available. All responses use `Cache-Control: no-store`.

The server wraps the unchanged assembler files in a deterministic stored ZIP (`zip-store-v1`):
stable ASCII path ordering, 1980-01-01 dates, no extras/comments, no symlink/executable entries,
maximum 256 files, 8 MiB per file and 16 MiB archive. Dotfiles and the exact diagram PNG are included.
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

`loadLocalV2Registry()` currently installs **no runtime, preset or feature implementation**. Its
trusted diagnostic emitter writes only `diagnostics/generation.json`, accompanied by a required
unfinished gap. This is infrastructure for later sequential units, not a standalone app. Project
envelope/build files start in YV2-04. No v2 studio preview or browser controls are wired yet.

```
pnpm --filter @jeeves/generator export:v2 /path/to/schema3-design.json /absolute/new-directory
```

The CLI exports this honest partial bundle using the existing `exportNewDirectory`; it refuses
every existing destination, including an empty or edited one, and symlink ancestors. It prints
completeness/findings without claiming the export runs. `planFileWrites` remains available for
pure edit/custom-file preservation checks. V1 continues using `export:new` unchanged.
