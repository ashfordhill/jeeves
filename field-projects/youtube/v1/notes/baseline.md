# FP04: actual untouched generated v1 baseline

The 108 files in [app/](../app/) are the actual output downloaded by mouse from Jeeves
**Generate project → Preview scaffold → Download project ZIP**, using the retained
**YouTube · field v1 · local Docker** project `293b4a2d-e25b-4a5b-83da-b27de7876f02`, saved revision
**3**. The flow ran on owner web/API 4300/4310 after FP03b commit
**`aedbd606342c5a369142b10cf127fc7130d50671`**. Two real download clicks produced identical ZIPs;
two current assembler calls also produced identical payloads. The archive was validated completely
before exclusive extraction into this new directory. No generated file was edited, formatted,
repaired or replaced; both emitted lockfiles and every `.jeeves` byte remain frozen.

The containing FP04 commit is recorded by the following FP05 unit, avoiding self-reference.
Use that commit as the comparison anchor before custom work. The generated manifest's historical
profile/source identity is preserved; it does not name this containing commit.

## Exact provenance

| Item | Frozen identity |
| --- | --- |
| Generator | `jeeves-generator@0.1.0-experimental.2` |
| Profile | `youtube-local-v1@1.0.0` |
| Templates | 19 families, each `0.1.0-experimental.1`; exact per-family source hashes in [manifest](../app/.jeeves/manifest.json) and [assembler inventory](evidence/fp04/assembler-result.json) |
| Canonical saved source SHA256 | `7d1874a1e74c6bf53df9058a9b2f826b4d83def2aaddb328022747355979cc93` |
| Actual ZIP SHA256 | `c885dd34e323c1102447587db25d68d273c5897826c240db31a9c222b8269c86` |
| Actual ZIP / payload sizes | 946,247 bytes; 108 files totaling 931,999 payload bytes |
| Final `.jeeves/manifest.json` | 80,362 bytes; SHA256 `5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f` |
| Manifest hash scope | 107 payloads totaling 851,637 bytes; manifest excludes its own hash |
| Diagram | [005](../diagrams/005-local-intent-aligned/snapshot.json), PNG SHA256 `23c06f6dd8a4533456f962016bc9da1cd2d2ae57e4a56391643ade236dc5bdb9`, 3008×2752 |
| Image renderer | `a98bf708d4f70083e7ed4293eaa561561c67694d` |
| Application lockfile SHA256 | `c37b660e00f7575436c71834fc61e104681c8097bc326c7d11b89b35337138bf` |

[Frozen input manifest](../inputs/manifest.json), [bindings](../inputs/local-bindings.json) and
[runtime pins](../inputs/runtime-pins.json) retain all exact inputs, dependencies, image digests
and substitutions. The generated `.jeeves/inputs/` holds exact copies of all five JSON files and
005 PNG. The output manifest records every payload's hash, byte count, ownership, template and
source paths. [Expected payload inventory](evidence/fp04/expected-payloads.json.gz) also includes the
final manifest's external hash. No ZIP is committed; its verified extracted bytes are the artifact.

Architecture/source/view did not change. Existing [006](../diagrams/006-generation-ui/snapshot.json)
and [007](../diagrams/007-generation-draft-guard/snapshot.json) record the generation controls;
their containing commit is FP03b above. 005 remains authoritative for generation. No duplicate
architecture snapshot is needed. FP04's evidence images show the actual preview and TinyURL check.

## What was checked

The [archive verification](evidence/fp04/archive-verification.json) uses Python standard-library
`zipfile`, independently of the ZIP writer. Both actual archives pass every CRC and match all
current assembler bytes and all manifest hashes. Checks cover the exact sorted path inventory,
dotfiles, portable paths, collisions, traversal, regular file entries, fixed stored-ZIP metadata,
and exact frozen source/PNG bytes. No arbitrary paths, symlinks or overwrites are extracted.
New root/nonsecret directories are 0755 and files 0644, readable for future container mounts.

With Node **24.21.0** and pnpm **12.16.1**, both `field-projects/youtube/v1/app/` and the fresh
`/tmp/jeeves-fp04/independent-app/` extraction pass:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Each install supplies its own 109 packages and TypeScript **7.0.2** under its own `node_modules`.
No workspace/Jeeves imports, checkout-relative dependencies or parent compiler are used. All
108 source files and application locks still match the ZIP after installation/build. The Jeeves
root lockfile remains unchanged. Dependencies and `dist/` are ignored and excluded from the commit.
No field setup, runtime secrets, media fixtures or new field containers were created in FP04.

The seven independently compiled extensions were invoked with empty diagnostic input; each rejects
with `CUSTOM_IMPLEMENTATION_REQUIRED`, status 501. Source inspection confirms the HTTP fallback
throws the same error, worker shells throw instead of processing, and the browser page is a static
scaffold notice. Actual HTTP501/provider helper probes already exist in [FP03a](evidence/fp03a/README.md);
that 14-container campaign was not repeated. This is bounded failure/build evidence, not a working
YouTube claim, completed scenario, runtime certification or verification upgrade. See
[FP04 evidence](evidence/fp04/README.md) for commands, logs, required Jeeves checks and script mistakes.

## Stable observable comparison baseline

These observations use the frozen [S01–S08 scope](scenarios.md). Complete application walkthroughs
remain **not run** in the immutable report. No whole feature receives credit from configuration,
empty shells, installed binaries or helper probes. The table records supplied foundations and
missing observable behavior; the FP05 implementation plan is intentionally separate.

| Scenario | Supplied foundation and observed baseline limit |
| --- | --- |
| S01 setup/sign-in | Own frozen install/build passes here and independently. FP03a bounded container readiness/OIDC helper evidence exists. Browser is a static notice; no integrated sign-in/identity/sign-out interface. Scenario incomplete/unrun. |
| S02 authenticated multipart upload | Generated S3/JWT clients and earlier raw multipart/CORS helper probes exist. Upload HTTP shell has no creator-owned start/sign/complete flow or browser chooser. Scenario incomplete/unrun. |
| S03 resume/abort | S3 client primitives exist; no durable owned upload records, refresh/resume or abort interface. Scenario incomplete/unrun. |
| S04 processing/publication | Pinned FFmpeg installation, broker and worker shells exist. Encoding/packaging/thumbnail extensions throw; no lifecycle, encoded media or successful public publication. Scenario incomplete/unrun. |
| S05 public playback | Edge and hls.js dependency exist. No player/watch data, HLS output or observed decoding/seek. Scenario incomplete/unrun. |
| S06 public-only search | OpenSearch client/empty index setup exists. Query/index extensions throw; no committed-ready projection, search UI or public-only query. Scenario incomplete/unrun. |
| S07 eventual counts | Counts database, event transport and worker shell exist. Counter extension throws; no playback event policy, transactional receipts, increment or visible count. Scenario incomplete/unrun. |
| S08 failures/independence | Independent build and explicit extension failures observed; prior private-original/helper checks exist. No integrated application errors, invalid-media handling or persistence/playback walkthrough. Scenario incomplete/unrun. |

G01–G08, seven named business extensions and all 25 unsupported setting paths remain open. The
generated report remains `applicationComplete: false`; strict readiness remains ineligible,
template availability `none`, runtime verification `none`. No percentage, time/token saving or
completed business behavior is inferred. Actual custom completion effort is still unmeasured.

## FP05 containing-commit reference

FP04's actual containing commit is **`02ac280da62616e9c7aad7f88457dcb72084cb25`**. It follows
FP03b **`aedbd606342c5a369142b10cf127fc7130d50671`**. Use FP04, rather than later custom source
or a new generator run, as the byte/provenance comparison anchor. The [FP05 implementation
plan](implementation-plan.md) reads the actual helpers/services/workers/scripts/Compose and
assigns FP06a–FP07b. It does not modify any of the108 generated files, frozen inputs, historical
snapshots, locks or reports, and does not close G01–G08 or pass an S01–S08 scenario.

## FP06a custom foundation provenance

FP05 containing commit is `aed1d1d29c2e41f3173d3d11fd771e8519e0a838`. The immutable comparison
anchor remains FP04 `02ac280da62616e9c7aad7f88457dcb72084cb25`; generator/templates/inputs and
`app/.jeeves` are unchanged. [Per-file provenance](evidence/fp06a/provenance.json) compares the107
hashed payloads plus manifest:83 payloads remain byte-identical,24 are modified for planned custom
integration, the manifest remains identical, and17 application files are newly custom. No dependency
or lock change, reused custom runtime source or retroactive template success is asserted. All seven
business extension files remain unchanged; no complete application scenario is claimed.

The changes implement the planned owned-state seam, source/config/grant/topology corrections and
HTTP/AMQP/outbox integration. They are distinct from a verified generic template or defect campaign.
A new confirm-timer cleanup and fatal-close signal were reviewed during custom implementation.
Real rollback/denial/duplicate/binding evidence supports this foundation only. G01–G03 have concrete
building blocks; their integration and all S01–S08 remain incomplete pending later assigned units.
Current schema3 revision6/native010 deliberately differs from frozen005 generation source; no
profile broadening or historical input/diagram/output-manifest rewriting keeps Generate eligible.
