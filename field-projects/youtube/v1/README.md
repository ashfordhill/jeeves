# YouTube v1: frozen starting point

FP01 freezes the saved diagram and a finite local mapping. **No generator, templates, application
output or measured functional coverage exists yet.** The next unit is FP02. The real untouched
generator output must be committed in FP04 before the custom implementation plan or application
code. Review working v1 with the owner before deciding on v2.

- [Diagram history](diagrams/index.md): original owner, approved PostgreSQL, separate v1 copy and
  each intentional local edit, with real mouse PNG downloads and 1280×800 studio screenshots.
- [Frozen input manifest](inputs/manifest.json): exact design/blueprint bytes, hashes and the
  final source-linked image. Source schema **2**, read-only blueprint **3**; no schema upgrade.
- [Local bindings](inputs/local-bindings.json) and [pins](inputs/runtime-pins.json): proposed
  finite selectors by canonical IDs, definitions and settings; explicit unsupported paths.
- [Mapping and gaps](notes/mapping-and-gaps.md), [runtime decisions](notes/local-runtime.md),
  [observable smoke scenarios](notes/scenarios.md), [decision/improvement ledger](notes/ledger.md)
  and [work log](notes/work-log.md).

The retained studio project is **YouTube · field v1 · local Docker**,
`293b4a2d-e25b-4a5b-83da-b27de7876f02`, revision **3**. It descends from owner YouTube
`0a12f132-b0f4-400d-9b94-51546911bb6b`, approved revision **2**. The owner's two engines changed
in one revision-checked API operation; its other fields, source/schema identity and history were
preserved. TinyURL revision 53 and Marketplace revision 1 remain unchanged.

This folder is outside Jeeves workspace discovery. There is deliberately no `app/` directory.
Runtime images, dependencies, fixture videos, data and secrets are not committed. Frozen JSON
under `diagrams/` and `inputs/` is excluded from Biome formatting so exact downloaded bytes and
recorded hashes survive; this does not exclude future field application code from checks.

Later edits append numbered snapshots and work-log entries; never replace this baseline. Record
FP01's containing commit in the next unit, avoiding a self-referential manifest. Later real
generator/template versions, output hashes, build results and source provenance belong to their
own checkpoints. The actual strict report remains `generationEligible: false`, template
availability `none` and runtime verification `none`.
