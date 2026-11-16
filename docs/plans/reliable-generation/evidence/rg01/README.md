# RG01 evidence — versioned capability contracts and hook migration

Completed against baseline `73266a1`. RG01 adds metadata and an update boundary; it adds no new
runtime capability and does not install the future guarded extension API.

## Contract and consumers

The current generated extension API is version **1**, explicitly `legacy-unrestricted`. The
version is independent of saved design schemas, template versions and the normalized format.
Pre-versioned exports mean the same legacy API v1, so compatible existing updates continue to work.

The existing `favoritesStackDesign(true)` fixture supplies four implemented HTTP operations:
`favorites.add`, `favorites.remove`, `favorites.check`, and `favorites.list`. The new records
extend `NormalizedGeneration`; there is no second intermediate model or saved-design change.

| Record | Implemented consumer/check |
| --- | --- |
| Stable capability/selection/module/process IDs, owner/role and source paths | Resolver traces the selected existing module and ownership role; normalized JSON and the support report preserve these facts for inspection. |
| Named/versioned callable input/output contracts and finite effect class | Strict serializable contract schema; registry accepts only the exact existing Favorites descriptors, with one implementation owner; resolver requires the installed contract at the selection's source path. The generated guide lists each installed operation/version/effect. |
| Declared state access, required principal/guard, dependencies | Resolver derives the existing Favorites state link and verified-identity selection; a missing guard selection refuses with its source location. Normalized/report records identify this existing HTTP contract, not a new unrestricted in-process binding. |
| Lifecycle owner/mechanism | Normalized/report record identifies the existing process and `src/runtime/process.ts` scope. This is conservative legacy metadata, not RG02's unified lifecycle guarantee. |
| Callable installation/output responsibility | `local.favorites` registers its real `src/runtime/favorites.ts` output; assembler verifies the installed emitter actually emitted the attested file. A missing output fails the fixture test. Future capabilities remain absent. |
| Extension API version/public API location | Normalized model, manifest and report record v1; `.jeeves/extensions.md` names future `src/extension-api/index.ts` and explicitly says that API is not installed. The updater consumes the version. |

No arbitrary code, function, TypeScript type expression or executable value enters these records.
Tests round-trip the model through JSON, vary equivalent object property order, preserve source
bytes, reject executable/unknown schema fields and name missing capabilities at actionable paths.

## Migration boundary

`update:v2` accepts `--ack-extension-api=<target version>`. A version mismatch refuses automatically
and reports the handwritten hook/stub paths. Wrong acknowledgement, unresolved generated overrides
and failed interface builds refuse without applying. Malformed previous version metadata refuses.

After explicit acknowledgement, the updater creates a disposable staging copy of application
source, overlays the planned new generated files, and runs the installed TypeScript compiler with
`--noEmit`. It excludes dependency trees, repository/runtime state, dist and `.env` files; installed
dependencies are linked for compilation. It does not execute an editable build script, install
packages, rewrite handwritten bodies or require the old checkout to contain the new runtime.
Scratch output is removed in `finally`. This checks the TypeScript build, not runtime behavior or
hostile-code confinement. The target export's exact dependencies must already be installed.

The offline update fixture changes a real TypeScript interface from `{ old: string }` to
`{ next: string }`, rather than merely bumping metadata. It proves:

- Automatic update and dry run preserve the modified old hook and every target file byte-for-byte.
- Explicit acknowledgement with the old hook fails the actual compiler and preserves all bytes.
- A manually migrated hook using `input.next` passes acknowledged `--check` in staging while the
  old checkout still contains only `old`; the target snapshot stays identical.
- Applying that acknowledged migration installs the new generated interface and manifest version,
  preserving the manually migrated hook bytes exactly.
- Legacy missing-version metadata remains compatible with v1; malformed versions refuse.

Actual new v2 production hook APIs/data migration are not claimed; RG01's fixture establishes the
guard before those changes. No generated-system/Docker checkpoint ran. The coordinator completed the required scratch
regeneration proof: a real Favorites export emitted 58 files and four capability records; its
guide, manifest, report and normalized files were read successfully with extension API v1
(`legacy-unrestricted`). The task-owned temporary export was removed in `finally`.
[Recorded fixture output](fixture.json) contains the emitted file inventory and capability records.

## Emitted paths and reviewed pins

New payload: `.jeeves/extensions.md`. Metadata changes: `.jeeves/normalized.json`,
`.jeeves/report.json`, `.jeeves/manifest.json`, and the existing normalized diagnostic mirror
`diagnostics/generation.json`. Emitter/source fingerprints also change normally.

The coordinator regenerated the three v2 processes-off pins successfully. Reviewed counts:
frozen-v2 **73 → 74**, module design **79 → 80**, stub stack **54 → 55**. Only the new guide and
those normalized/report/manifest/diagnostic records change. All existing runtime/application
payload pins remain identical. The historical normalized artifact stays untouched; its test adds
only explicit new metadata to the expected model. Frozen v1 source/output remain unchanged.

## Verification

All commands used Node **24.21.0** from `/home/ash/.nvm/versions/node/v24.21.0/bin`.

| Check | Actual result |
| --- | --- |
| Coordinator scratch regeneration inspection | Exit 0; 58 files, four Favorites capabilities, v1 metadata and guide read; temporary export removed. [Fixture output](fixture.json). |
| Focused resolver/schema/offline update run | 61 passed; `/tmp/jeeves-rg01-focused.log`. |
| Focused affected model/support/file-list/migration tests | 63 passed; `/tmp/jeeves-rg01-focused-final.log`. |
| Final `pnpm check` | Exit 0; 120 files / 1,072 tests, lint and all typechecks pass. `/tmp/jeeves-rg01-check-final.log`. One pre-existing informational lint message remains. |
| `pnpm --filter @jeeves/web build` | Exit 0; `/tmp/jeeves-rg01-web-build.log`. Existing chunk-size warning remains. |
| Standard `pnpm test:e2e` | 73 passed, one stale QL05 assertion failed; `/tmp/jeeves-rg01-e2e.log`. |
| Corrected affected browser case | Coordinator ran exact `module-authoring.spec.ts` “Generate project lists each module's status and previews its stubs” case: exit 0, 1 passed (7.5 s); `/tmp/jeeves-rg01-e2e-targeted.log`. |
| Browser coverage | Existing suite loaded the app and TinyURL lane canvas and exercised generation preview/download and mouse authoring. No new canvas control or chat command was added. |
| Protected paths | Root-file hashes match the coordinator's initial snapshot; frozen v1 and historical exports/evidence are unchanged. Owner dirty feedback/Zone.Identifier/mode changes were preserved. |

The initial e2e failure selected `row.files.at(-1)` as the stub body. QL05 had already added
`src/runtime/settings.ts`, which sorts after it. The correction checks each complete four-file
list (dependencies, slots, body, settings), preserving and strengthening the original assertion.
Only that failed case was rerun after correction; the 73 successful cases were not repeated.

The initial sandboxed full check had expected metadata assertions plus denied subprocess/socket
operations; it was diagnosed, corrected where appropriate and superseded by the passing final
check. Normal targeted e2e also encountered tsx IPC `EPERM`; the coordinator's successful rerun
supersedes it. Early escalation requests were canceled while awaiting tool approval. The owner
subsequently clarified full execution access and no routine permission prompts; that authorization
did not change protected-path or runtime scope. No approval blocker remains.

Docker was used only for the established e2e Postgres dependency. Coordinator before/after
inventory matches exactly: only `c0fbbc2996fe jeeves-postgres-1`, PostgreSQL 17 Alpine at
`127.0.0.1:54329->5432/tcp`. No generated-system resources were created. E2e uses
ports 4301/4311, the `jeeves_e2e` database and its normal project cleanup. Owner ports 4300/4310
were not used.

## Next-unit boundary

RG02 can consume the serializable installed capability records and rely on explicit extension
API migration refusal. Increment the API version before an incompatible handwritten API change.
Keep legacy v1 readable; do not relabel it as guarded. Unifying lifecycle/client ownership and
adding the guarded public API remain RG02 work. No extra follow-on work is assigned here.

The implementing agent's normal explicit-path `git add` failed because its inherited `.git`
mount is read-only (`Unable to create .git/index.lock`). No staging change occurred. The
coordinator creates the authorized single local RG01 commit with only this unit's explicit paths,
including the recorded scratch fixture output; this access limitation does not leave a code or
verification requirement outstanding.
