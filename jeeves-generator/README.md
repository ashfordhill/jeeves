# Experimental generator foundation

FP03a provides `@jeeves/generator`, a Node/TypeScript workspace package exporting source directly.
It assembles deterministic **in-memory file bundles** through trusted local template code.
The explicit `localV1Templates` registry installs **19 experimental local template families** and
a conservative new-directory exporter. There is no archive/HTTP/browser flow yet (FP03b), and no
field application is committed (FP04). G01–G08 custom implementation follows the actual baseline.

Only the frozen `youtube-local-v1@1.0.0` profile is accepted: source schema2, blueprint3,
snapshot005, source hash `7d1874a1…7979cc93`, project revision3. This is deliberately a finite
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
Production server packaging must ship `jeeves-generator/` (including source/assets) and the five
`field-projects/youtube/v1/inputs/` files plus `diagrams/005-local-intent-aligned/diagram.png` at
their repository-relative locations. FP03b can call the same loader/assembler API.

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
