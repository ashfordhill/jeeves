# YouTube v1: working custom local app, ready for owner review

FP01 freezes the saved diagram and a finite local mapping. FP02 adds the
[experimental generator foundation](../../../jeeves-generator/README.md), pinned to these exact
inputs, with deterministic in-memory bundles and explicit partial reports. FP03a now adds
**19 real experimental template families and an independent scratch build** of actual output;
[evidence](notes/evidence/fp03a/README.md) distinguishes infrastructure checks from business gaps.
FP03b adds guarded mouse preview/ZIP download of that same real output, including frozen inputs
and PNG; exact-source checks refuse other designs and preserve strict readiness. FP04 retains the
actual untouched mouse-downloaded output in [app/](app/), with [baseline provenance and observable
limits](notes/baseline.md) and [independent build evidence](notes/evidence/fp04/README.md).
FP05 supplies the [custom completion plan](notes/implementation-plan.md), anchored to FP04 commit
`02ac280da62616e9c7aad7f88457dcb72084cb25`. FP06a now supplies the [custom owned-state foundation](notes/fp06a-foundation.md): schema3
Video authority, private SQL/views, runtime grants, finite contracts/transitions/inbox/outbox and
transport integration, with [bounded SQL/broker evidence](notes/evidence/fp06a/README.md). FP06b
adds actual [creator/multipart/resume/abort uploads](notes/fp06b-upload.md). FP06c adds real CPU
encoding, lifecycle publication and [public HLS playback](notes/fp06c-playback.md), with
[bounded media/browser evidence](notes/evidence/fp06c/README.md). FP07a adds [committed-public search and playback counts](notes/fp07a-search-counts.md).
FP07b completes the [independent integrated walkthrough](notes/evidence/fp07b/README.md) and
[owner/fresh-agent review pack](notes/review-pack.md). S01–S04 and S06–S08 pass bounded independent
flows; S05 has decoded video/unmuted 440 Hz PCM/mouse seek evidence but **no human listening**.
The retained owner app runs fourteen services at **http://127.0.0.1:4400/**; see [start/stop and
credential paths](app/README.md). Next is **FP08 owner/fresh-agent review**, with no automatic v2.
The generated baseline supplied useful foundations and zero complete frozen scenarios; custom
completion is not retroactively generated or measured effort savings.

- [Diagram history](diagrams/index.md): original owner, approved PostgreSQL, separate v1 copy and
  each intentional local edit, with real mouse PNG downloads and 1280×800 studio screenshots.
- [Frozen input manifest](inputs/manifest.json): exact design/blueprint bytes, hashes and the
  final source-linked image. Frozen source schema **2**, read-only blueprint **3**; these historical inputs never upgrade.
- [Local bindings](inputs/local-bindings.json) and [pins](inputs/runtime-pins.json): proposed
  finite selectors by canonical IDs, definitions and settings; explicit unsupported paths.
- [Mapping and gaps](notes/mapping-and-gaps.md), [runtime decisions](notes/local-runtime.md),
  [observable smoke scenarios](notes/scenarios.md), [decision/improvement ledger](notes/ledger.md)
  and [work log](notes/work-log.md).

The retained studio project is **YouTube · field v1 · local Docker**,
`293b4a2d-e25b-4a5b-83da-b27de7876f02`, current schema **3**, revision **6**, with [native010](diagrams/010-readable-upload-role/snapshot.json).
Frozen generation source remains schema2 revision3/snapshot005. It descends from owner YouTube
`0a12f132-b0f4-400d-9b94-51546911bb6b`, approved revision **2**. The owner's two engines changed
in one revision-checked API operation; its other fields, source/schema identity and history were
preserved. TinyURL revision 53 and Marketplace revision 1 remain unchanged.

The field app is outside Jeeves workspace discovery and builds with its own package/lockfile.
Runtime images, dependencies, fixture videos, data and secrets are not committed. Frozen JSON
under `diagrams/` and `inputs/` is excluded from Biome formatting so exact downloaded bytes and
recorded hashes survive. FP03a adds an exact `app/` exclusion from root Biome because the field
application is an independent project: later handoffs must run its own frozen-lockfile install,
TypeScript build and applicable field checks. This supersedes FP01's earlier no-app-exclusion
choice without changing those historical records. No current studio/generator checks are removed.

Later edits append numbered snapshots and work-log entries; never replace this baseline. The appended [FP02 work-log entry](notes/work-log.md) records FP01's containing commit, avoiding
a self-referential frozen manifest. Later real
generator/template versions, output hashes, build results and source provenance belong to their
own checkpoints. The actual strict report remains `generationEligible: false`, template
availability `none` and runtime verification `none`.

[Source-line benchmark](../../../docs/field-projects/source-loc.md): v1 production `src/` contains
159 retained template lines and 2,715 post-template lines (5.53% template share), excluding
tests/configuration/infrastructure and the separate browser folder.
