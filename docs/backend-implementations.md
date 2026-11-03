# Exact backend implementation support (P69)

P69 adds a pure availability report and implementation selection. It supplies no backend runtime,
application generation. Every production manifest still lacks these new
backend descriptors. The three benchmark applications remain absent/not run with zero observed
implementation points. [P70](backend-plan.md) now supplies a complete pure compiler plan, exact obligation accounting and
explicit mode/snapshot routing. Runtime availability is unchanged; legacy emission rejects backend
inputs before filesystem reads. P71a is next.

## Model and registered claims

The optional manifest `capabilities` array contains strict `schemaVersion: 1` descriptors, each with
an exact `{id, version}` inside an exact registered template version. Omission preserves legacy
manifest serialization. Registry descriptions serialize descriptors without executable Zod objects;
manifest config remains the existing Zod contract. Duplicate exact descriptors, option paths and
hook slots are rejected. All bounds and schemas live in
[backend-implementation-model.ts](../packages/spec/src/backend-implementation-model.ts).

A descriptor declares its allowed C2/C3/operation/relationship targets, supported obligation kinds,
typed shapes, finite option support, host roles/templates, store templates, transports, trusted
context and current-state revocation sites. `requires.context` and `requires.revocation` enumerate
the context/recheck support the implementation supplies to its consumers. Exact dependencies and
conflicts apply within a host. Origin identifies the template, library or adapter package/version.
`evidencePackIds` name expected checks; they are never observed passes.

Options compare literal paths in a projection of parsed typed declarations. `*` means one array
item; array `.length` demands preserve cardinality. There is no root wildcard, evaluation, code,
SQL or expression language. Support uses finite scalar values, inclusive numeric ranges, bounded
scalar types, or an exact typed hook slot. Every undeclared semantic path stays unsupported.
Identity/version/name/prose fields are excluded from option matching; exact references and
structural validators remain authoritative. UX5 behavior prose and workload objectives supply no
implementation support. Contract shapes retain exact type/bound declarations as separate obligations.

The optional `architecture.backend.implementations` collection selects a template, exact descriptor,
primary target, explicit model obligations, authoritative store, and optional typed hooks/environment.
A target is a C2 container, C3 component, exact backend operation, C2 connection or C3 relationship.
Model obligations include datasets, interface bindings, contracts and all backend declaration kinds.
Store, hook and model references are remapped with composition; registered template/capability IDs
and environment/credential registry identities remain pinned. Environment records select fixture or
production mode, exact adapter interface binding and configuration/credential registry IDs. They
contain no credential values and do not prove that a registry or provider is currently reachable.

## Matching and readiness

[backend-support.ts](../packages/spec/src/backend-support.ts) evaluates the complete original design.
Each obligation reports `supported`, `needs-explicit-hook`, `unsupported` or `incompatible`, with
specific reasons and selected versions. Unbound obligations, unknown versions, omitted options,
missing context/rechecks and absent/cyclic dependencies remain blocking. Wrong transaction stores,
conflicts, ambiguous claims, incompatible hosts or hook signatures remain incompatible. A hook
cannot repair an unsupported store, authority or revocation requirement.

Each C2/C3/relationship barrier needs its own primary selection. A component cannot supply its
whole host. Relationship selections must explicitly include the exact participating interface
binding and its transport. An arrow label supplies no adapter wiring. External adapters additionally
need an environment record and an interface owned by that exact external container. A local host
cannot be supplied by an attachment alone. All original typed declarations and contract definitions
remain accounted for; no declaration is silently dropped to improve a readiness verdict.

Foundation readiness allows explicitly selected compatible typed hook seams whose implementation
and acceptance remain pending. Full declared support requires every obligation to be supplied.
Both also require no non-availability error diagnostics. Neither verdict is design-review approval
or observed evidence. Raw findings, including every legacy `NEEDS_TEMPLATE`, remain inspectable.
The global `blocksGenerate` predicate is unchanged; even a supported synthetic manifest report does
not authorize generation. P70 accounts for each availability barrier only in its pure plan and guards
the legacy writer. Shared contracts have a host constraint only when their consumer host is unique. Implementation-selected exact definitions preserve
semantics across simultaneous consumer removal; create a successor to change them deliberately.

## Authoring and handoff

**Review → Implementation support** selects one primary target and exact registered descriptor,
explicit obligations, store and typed hook slots. Imported unavailable selections stay visible and
can be renamed, retained or cleared. External environment details use bounded registry IDs. Supporting
obligation explanations and all raw diagnostics sit behind disclosures. There is no JSON/code editor.

Review shares Save/Cancel, revision conflict retention and atomic history. Save rejects structural
errors while retaining saveable missing decisions. Component technical details and planned C2
container/relationship inspectors expose support. The architecture catalog distinguishes families
from registered modules; Evidence distinguishes expected packs from recorded verification.

Portable handoff includes exact selections, available descriptor definitions, per-obligation reasons,
pending hooks and separate Foundation/Full support. The existing design-review status and recorded
evidence keep their own meanings. Unknown manifests remain unknown. Export, target diffs, fragment
extraction/insertion, reference removal diagnostics, operation JSON Schema and fingerprints preserve
these declarations. No selected implementation mutates saved `planned`/`template` flags.
