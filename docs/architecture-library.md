# Local reusable architecture library

P55 adds **Library → Saved architecture templates**. **Save as architecture template**
selects one or more C2 containers or C3 components from the saved revision. Selecting a
container includes its components; a single component is a valid template. Dependencies
outside the copied selection become required hosts, responsibilities, context roles and
exact interfaces. They are never silently included as implementations.

Review the name, purpose, compatible hosts, required roles, invariant declarations, finite
component options and extension points, then save a draft or publish the version. The review
shows interfaces and relationship policy declarations. Draft edits use a draft revision;
stale edits cannot overwrite another save. Cancel leaves the existing draft unchanged.
An unused draft can be deleted. Published content is immutable: create a new draft version
and publish it separately. Retirement removes a version from new insertion and ordinary chat
selection, while keeping its source record and every consumer's provenance.

## Portable artifact and local storage

The [extractor](../packages/spec/src/architecture-library.ts) uses P50's existing declarative
fragment format and P47/P48/P54 schemas. It follows explicit interface, relationship, dataset,
scenario and linked requirement/decision references. Fragment-local identities replace source
graph identities. Context actors and external providers are required roles; externally owned
boundaries retain their existing target identity. Scenario alternative paths, client states,
contracts and outcomes reference the same mapped identities. Authored expectation reviews and
decision acknowledgements do not transfer as evidence.

Copied boundaries are planned architecture, including when a known executable container supplies
the selected logical boundary. No runtime attachments, project/system identity, recipe binding,
output paths, implementation notes, annotation provenance, deployment placements or run evidence
enter the artifact. Configuration keeps only catalog-declared finite choices, booleans and
numeric targets. Arbitrary keys and free-text configuration do not transfer. Reviewed names,
responsibilities, contracts, policies and invariant/extension text are architecture content.

Runtime-owned component members and source-backed contracts are explicitly refused, with a
message requesting a portable planned responsibility/contract. They cannot be made portable by
copying private source configuration or inventing an equivalent shape. Unknown runtime families
and deployment infrastructure also require an explicit portable planned boundary. This library
publishes architecture intent, not runtime packages or code. Existing runtime templates, recipe
ownership and `NEEDS_TEMPLATE` behavior remain separate and unchanged.

The [server catalog](../apps/server/src/architecture/library.ts) stores bounded, schema-validated
entries in `architecture-library.json` under `JEEVES_HOME` (normally `~/.jeeves`). One local
server owns atomic file replacement; directories/files use owner-only creation permissions.
SHA-256 covers the canonical fragment and reviewed metadata. Loading detects conflicting version
identities or modified content. The catalog survives restart independently of projects; deleting
a project does not delete published versions. There is no database migration, remote installation,
uploaded executable content, public marketplace or automatic version resolution.

## Insertion and provenance

Preview uses the same [P50 expansion](../packages/spec/src/architecture-patterns.ts) as built-ins.
Required hosts check classification, ownership, runtime host compatibility, portable family and
retained configuration. Required responsibilities additionally need the selected host, declared
capability/configuration, exact interface direction/necessity and version/shape, and compatible
current policy declarations. Missing/ambiguous interfaces and incompatible guarantees remain
visible. Names and family alone cannot establish compatibility. Ordinary copied component/boundary
reuse remains conservative, requiring intact pinned expansion provenance.

Each insertion gets independent instance/graph identities and one semantic operation batch.
Explicit required-role selection retains those roles' exact definition identities. Other definitions
are fresh unless the user deliberately chooses an existing identity with every required exact
version and shape. Several versions of one definition retain their shared identity. No schema
subtyping or inferred adapter is supplied.

Finite exposed options change only the selected copied component's declared configuration.
Relationship policy guarantees and invariants remain visible. Optional historical
`libraryContentHash` and `libraryOptions` extend `architecture.patternInstances`; the existing
pattern/version, saved base, configuration, identities and invariants stay pinned. Editing an
expanded instance never edits its source. Publishing v2 never rewrites v1 consumers. Historical
provenance records authoring intent, not proof of current satisfaction or execution.

Fixed Apply/Cancel, undo/redo and reload use normal design history. Mouse insertion rechecks the
published source and design revision before applying. Conflicts retain the draft. Chat uses
`listArchitectureLibrary`, `describeArchitectureLibrary`, `previewArchitectureLibrary` and
`applyArchitectureLibrary`, with the exact version/content hash and saved
`getDesign.patternBaseRevision`. The whole turn is one undo step. Pattern-bearing turns refuse
generic stale-operation replay; ordinary supplied planning choices need no extra approval.

See [P55 evidence](evidence/p55/README.md). P56's combined QRWTY/non-QR proof remains separate.
