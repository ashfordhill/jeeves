# Pure backend data plan (P70a)

P70a supplies the versioned compiler types and a pure data-lowering seam. It does not render a
runtime, write output, select a generation mode or change the existing generator. P70 remains
incomplete until [P70b](plans/backend-benchmarks/execution-units.md) adds operation/effect/hook
lowering, complete plan previews, mode/readiness handling and the legacy routing guard.

## Calling the data stage

`lowerBackendData(design, lookup)` is exported by `@jeeves/generator`. Its input is the existing
schema-validated `DesignDocument` and a manifest-only `TemplateLookup`; there are no template
emitters, filesystem operations, provider calls, randomness or clock reads in this stage.
[backend-plan.ts](../packages/generator/src/backend-plan.ts) implements the seam and
[backend-ir.ts](../packages/generator/src/backend-ir.ts) defines its `schemaVersion: 1` types.

The detached, deeply frozen result contains:

- `stage: "data"` and `enabled`: only an existing versioned `architecture.backend` enables lowering.
  Legacy designs return no IR, preserving their original design and generation path.
- `sourceSnapshot`: the complete original authored design, including labels, planned flags,
  configurations, exact references and collection ordering. This is compilation provenance, not a
  second editable specification or a transformed executable design.
- `ir`: hosts, entities and fields, aggregates, bounded queries, access policies and access bindings.
  Exact references remain visible alongside resolved IR links. Missing links remain unresolved.
- `sourceMap`: every lowered responsibility's compiler identity and stable source path. Collection
  segments use IDs or `id@version`, rather than array positions, so presentation ordering cannot
  retarget a diagnostic or mapping.
- `diagnostics`, `rawFindings` and `support`: compiler diagnostics, verbatim design validation, and
  the complete [P69 exact support report](backend-implementations.md), respectively. Expected evidence
  pack IDs remain claims about required checks; they are never recorded passes.

There is no data-stage executable verdict. It intentionally returns analysis for unsupported or
incomplete designs. Raw `NEEDS_TEMPLATE` and structural findings remain intact, and the global
`blocksGenerate` predicate and `planProject` entry point retain their existing behavior. A compatible
isolated descriptor is not a production implementation or authorization to write output.

## Identity, authority and finite semantics

Compiler identities use unambiguous JSON tuples of responsibility kind, stable IDs and exact
versions. Symbols escape punctuation and separators injectively. Physical table and column
identities remain the authored `storageId` values. A presentation rename changes the snapshot's
labels, without changing semantic IR, source maps or storage identities. Object keys and unordered
collections are canonicalized; primary/index key tuples, query sort/cursor tuples and other semantic
ordering retain their declared order. Dependency-bearing joins retain their exact `from` relation.

Entity types resolve from the exact data contract through the existing bounded resolver. Persistence
annotations preserve optional versus nullable, server ownership, scalar bounds, enums, bounded opaque
JSON and integer-minor-unit/currency storage. The dataset remains the sole authority for the entity's
owner/store; lowering does not manufacture a competing session schema or a mutable contract copy.
Relations, uniqueness/null semantics, indexes, concurrency and finite invariants remain explicit.

Queries retain root/join identities, nullability, finite filters, projection, ordered keyset cursor,
limits and freshness. Root and joined sources resolve their own exact policy/projection. Unresolved
or cyclic aliases stay in analysis with diagnostics. Policies retain trusted context, default deny,
deny precedence, finite clauses, separate projections and current-state revocation. Access precedes
filtering, pagination, counts and projection in the IR contract; no policy or query executes here.

The existing validators and matcher report option, exact-version, authority, scope, type, context,
revocation and implementation incompatibilities. Additional compiler diagnostics identify unresolved
authority/types/query sources, cross-host/store aggregate boundaries, cross-store query joins, table
identity conflicts and repeated compiler identities/symbols. Successive versions of one entity keep
separate compiler identities while preserving their physical storage identity. Invalid intent is
retained for inspection and cannot establish support.

## Remaining boundary

The shared IR types reserve operation adapters, transactions/participants, effects, runtime
dependencies and typed hook obligations for P70b. P70a does not populate these shapes or supply a
complete preview, readiness gate, runtime projection, route/hook-path collision analysis, output
writer, migration model or generation snapshot. P70b must account for the full original planned
C2/C3/relationship graph and its external adapters before any later emitter can consume it.

[Isolated compiler fixtures](../packages/generator/src/backend-plan-fixture.ts) never enter the
production registry or module list. Offline checks exercise the data stage and unchanged legacy
plans/golden output. No benchmark application was generated or verified by this package; runtime
availability, frozen artifacts and the three applications' zero observed implementation points are
unchanged.
