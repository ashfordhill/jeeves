# FP03b evidence: guarded preview and deterministic ZIP

Base FP03a **`5c79e4efe932b6ae138d966e2373f89216d8dd0c`**. One sequential unit on primary main;
no branches/worktrees/stash/subdelegation/push. This is studio/generator integration investment,
not custom field application work. No `app/` or business implementation is committed.

The mouse flow is **Generate project → Preview scaffold → Download project ZIP**. Read-only POST
`/projects/:id/experimental-generation/{preview,download}` checks profile, saved revision and full
canonical source hash, rechecks after assembly, and requires the preview archive hash at download.
Browser work checks drafts/history/current project, rechecks saved source and hashes response bytes.
Closing/switching cancels pending work. Unknown profiles/sources refuse; another current design
never silently receives the frozen baseline. Exact source copies retain explicit selected-project
versus frozen-profile origin. Request bodies accept no output paths, uploaded assets or code.

Output is the unchanged real FP03a assembler/registry bundle. No generator/report/template bytes
changed, so generator identity remains **0.1.0-experimental.2**, template versions remain
**0.1.0-experimental.1**, profile **youtube-local-v1@1.0.0**, authoritative image remains 005.
Strict readiness remains false/none/none; all 25 unsupported paths, G01–G08, seven extensions and
unrun S01–S08 remain. Configuration/emitted bytes establish no functional coverage or certification.

- Source SHA256: `7d1874a1e74c6bf53df9058a9b2f826b4d83def2aaddb328022747355979cc93`.
- ZIP SHA256: `c885dd34e323c1102447587db25d68d273c5897826c240db31a9c222b8269c86`.
- Manifest SHA256: `5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.
- 108 total files, 931,999 bytes including the 80,362-byte final manifest. The 107 hashed manifest
  payloads total 851,637 bytes; this explains the narrower FP03a payload-size convention.
- ZIP 946,247 bytes. Stored ZIP, sorted portable ASCII paths, 1980-01-01 timestamps, no comments,
  extras, executable/symlink entries or ZIP64. Limits 256 files, 8 MiB/file, 16 MiB archive.

[Independent verification](archive-verification.json) uses Python standard-library `zipfile`,
checks every path/byte count/SHA against the actual assembler inventory, all CRCs, fixed dates,
dotfiles and exact source-linked PNG. Actual mouse and packaged API archives match byte for byte;
no generated app is extracted/committed here. Reader and inventory are retained compressed.

Final sequential Node 24.21.0 checks: **pnpm check 398 tests / 50 files**, lint and all typechecks;
**pnpm test:e2e 36 native cases (1.2m)** with source steady; **web production build 922ms**, existing
chunk advisory only. Three new network-free PGlite/archive cases cover real output/copy provenance,
full project/history/layout/strict-report preservation, unsupported/stale/concurrent-source/archive
refusal, body allowlist and path/size/count bounds. Two new mouse cases cover real preview/download,
unsupported source, 503/retry, stale source, close/switch cancellation and invalid draft guards.
[E2E project lists](e2e-projects-after.txt) equal the before list: original default only.

Production Docker build and direct non-root uid 1000 module/asset import+assembly pass. A separately
started complete image's API successfully previews/downloads from a temporary exact source copy,
then deletes it; anonymous database volume/container are removed. Final image rebuilt after the UI
guard correction and rechecked as uid 1000, matching archive/manifest hashes. The earlier complete
API smoke and final module smoke share unchanged API behavior; the final route difference is
formatting. Workspace dependency resolves in production. Build-context inspection confirms
[only six field files](docker-context-files-final.log): five reviewed JSON inputs plus 005 PNG.
Future field apps/history and `.runtime` secrets are excluded by the outer `.dockerignore`.

[006 initial controls](../../../diagrams/006-generation-ui/snapshot.json) and
[007 draft guard](../../../diagrams/007-generation-draft-guard/snapshot.json) are actual immutable
native PNG/source/blueprint/capture/UI records at 1280×800. Fresh owned 4302/4312 instances sampled
dirty parent 5c79e4e; external file hashes supplement startup identity rather than treating HMR as
attestation. 007 covers final code: [audit](final-audit.json) checks 293 recorded files and every snapshot
artifact; only the later generator README startup-failure clarification differs, explicitly listed
as documentation in the final audit. Both clean PNGs are byte-identical to 005 (`23c06f6d…dc5bdb9`), 3008×2752, 21 tiles/25 lines.
The invalid name is restored without a saved edit. [Browser result](browser-result.json) proves
all four owner's complete project/design/history/layout/blueprint responses and listing unchanged;
TinyURL 53 renders 12/13 and mouse Fit/refusal works. No page errors; one expected HTTP 422 console
message accompanies the deliberately unsupported TinyURL request. UI and PNGs were inspected.

Retained failed attempts/corrections: copy test initially omitted system description restoration;
one chooser label was outdated; initial lock update pruned unrelated peer snapshots (reverted,
only generator importer retained); initial formatting needed a stable second pass; a temporary
TS evidence script needed `.mts`; fixed port 4304 was occupied and left untouched, then Docker
assigned an isolated loopback port. First Docker allow rules admitted extra history (hierarchical
exclusions now inspect as six files). Non-root startup caught private lock-asset permissions
(fixed with COPY ownership). One existing PGlite restart exceeded its unchanged 5s timeout;
unmodified isolated 12-test file and two later full 398-test runs passed. Native Buffer equality
replaces expensive deep byte-array assertions. First full E2E 35/36 exposed the inherited draft
flag ignoring invalid values; only generation trigger now considers every dirty/pending draft.
006 is retained; 007 captures that correction. No timeout weakened or test removed.

Owned capture 4302/4312 listeners, temporary container/anonymous volume and named images were
removed. Owner 4300/4310 and other Compose projects remain. Build cache/shared pinned images may
remain; no global prune. No runtime secrets, signed capabilities, model/cloud/paid calls or new
owner feedback images. `.jeeves-feedback/`, frozen inputs, 001–005, generator source/templates and
strict spec calculators remain untouched. FP04 now commits actual untouched output before FP05
custom planning; business scenarios remain unrun.


Coordinator operational check found the original owner API watcher still alive but its child
stopped: initial app.ts HMR ran before the new workspace link was installed and raised
ERR_MODULE_NOT_FOUND. A content-preserving touch of watched main.ts prompted that existing
watcher to restart successfully, without killing it or creating another watcher. Owner 4310 and
4300 proxy health/preview/download are healthy again; complete four-project state equality is
rechecked. This restores the known dev server and is distinct from the owned capture listeners,
which are stopped. Template assets load eagerly at module startup, so missing/unreadable template
files can prevent API startup; input/PNG or assembly failures within an available route return 503.
