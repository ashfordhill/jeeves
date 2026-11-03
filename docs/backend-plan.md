# Pure backend compilation plan (P70)

P70a/P70b supply a versioned, deterministic backend IR and complete pure plan preview. They do not
render runtime files, create hook stubs, register production implementations or generate applications.
P70 is complete. The next design unit is **P71a**; runtime/writer integration remains separately
assigned to P74a/P74b.

## Complete planning API

`planBackend(design, lookup, { mode })` is exported by `@jeeves/generator`. Select `analysis`,
`foundation` or `complete` explicitly. It consumes the original versioned backend model and exact
manifest descriptors. Analysis retains unsupported intent and reports `ready: false`.
Foundation allows fully specified safe project hooks; complete blocks all pending project hooks.
`compileBackendPlan` accepts foundation/complete and throws `BackendCompilationError` with the
complete inspectable plan if requirements are unresolved. All lowering is pure and detached.

The result contains:

- The full immutable IR, exact original design in `snapshot.design`, compiler version and selected
  mode. Mode changes therefore change the snapshot. Authored labels/order remain in provenance;
  semantic IR and stable source maps survive presentation renames and irrelevant permutations.
- Hosts, entities, queries, access policies/bindings, operation/transport adapters, transaction
  participants, effects, runtime dependencies and typed hook obligations. Original C3 components,
  C2/C3 relationships, interface bindings, interfaces, datasets, contracts, lifecycles, typed settings
  and legacy attachments also retain their own mapped intent responsibilities.
- Exact obligation accounting with output identities, selected binding and supported/external/hooked/
  unsupported status. A supplied C3 sibling cannot supply its host, sibling or relationship. Every
  required provided API operation needs exact backend behavior or an explicit external implementation.
- Every raw validation finding, all compiler diagnostics, separate blocking lists and the complete
  P69 support report. `availability` shows the exact obligations behind each discharged availability
  finding. The grouped backend-declaration finding requires every constituent obligation. Unsupported
  domain strategies, anonymous requirements and structural errors always persist as blockers.
- Pending hooks, bounded dependency/order graphs, selected exact template/capability/package versions,
  environment/credential registry IDs and expected evidence packs. No secret values or observed
  verification results are invented. Fixture and production environment claims remain distinguishable.

A safe hook retains its exact signature, owner, source/failure transactions, current-policy rules,
readiness before mutation, unchanged 501/503 outcome with no writes, dependencies, acceptance IDs and
project-owned seam path. The shared validators reject invalid or incomplete hooks; an unselected or
mismatched descriptor slot cannot receive foundation treatment. `ready` describes compilation-plan
readiness only. It is separate from architecture review, application completion and runtime evidence.
`runtimeOutputAvailable` is always false.

`backendPlanJson(plan)` returns canonical complete JSON. `backendPlanText(plan)` adds readable
collection/obligation/status summaries and the lossless formatted plan, including snapshot, all intent,
raw diagnostics and source map. No UI or HTTP preview was introduced in P70.

## Routing and legacy guard

`planGeneration(design, templates, options)` routes versioned backend inputs to the pure plan and
requires `backendMode`. It returns the discriminated `backend-plan` or `legacy` result. Unopted
legacy designs keep their existing `ProjectPlan` byte-for-byte; supplying a backend mode without a
backend model is rejected. Existing `planProject` and `generateProject` reject backend inputs with a
clear preview-only message, before legacy emission or filesystem reads. No backend plan enters a
writer and no runtime emitter is supplied.

Raw `NEEDS_TEMPLATE` findings and the global `blocksGenerate` predicate are unchanged. The new plan
accounts for each original availability barrier locally. It never edits saved planned/template flags,
removes unsupported nodes, creates a second editable model or mutates private projects/previews.
The existing lock, resource migrations, module registry and legacy output formats remain unchanged.
Future persisted mode/output/ownership integration belongs to P74b.

## Resolution and blockers

Stable compiler identities use injective tuples and escaped symbols. The complete plan adds exact
host/store/participant boundaries, provided-operation accounting, route conflicts across contracts
within one application, hook path collisions, unresolved dependencies and execution dependency cycles.
Ordinary bidirectional C2 collaboration remains legal. Effect order and hook/runtime dependencies must
be acyclic. No collection is truncated or silently overwritten on failure.

Contract definitions reused across different hosts no longer inherit the first consumer's host in
P69 matching: only a unique consumer host constrains the shared definition. This narrow dependency
correction makes support independent of interface ordering without changing any saved identities.
All actual operation, transaction, relationship and external adapter boundaries still use exact hosts.

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
incomplete designs; use the complete planner above for mode-specific readiness. Raw `NEEDS_TEMPLATE` and structural findings remain intact, and the global
`blocksGenerate` predicate retains its existing behavior. The legacy entry points now explicitly
refuse versioned backend inputs before emission. A compatible
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

## Verification boundary

[Isolated compiler fixtures](../packages/generator/src/backend-compile-fixture.ts) exercise a complete
planned C2/C3/connection graph, exact relationship wiring, external adapter claims and safe hooks.
They never enter the production registry or module list. Focused offline tests cover every IR
collection, unsupported siblings/options/strategies, incomplete hooks, cycles/collisions, original
identity/raw-finding preservation, deterministic names/source maps, immutable results and unchanged
legacy plans/golden outputs. A separate writer-boundary test proves backend inputs are rejected before
reading a lock or invoking a vendor.

No benchmark application was generated or verified. Runtime availability, frozen artifacts and the
three applications' zero observed implementation points remain unchanged. No SQL, runtime descriptors,
hook files or migration files are emitted. Production manifests still advertise zero backend capability
descriptors. Complete example authoring starts with P71a only when separately assigned.
