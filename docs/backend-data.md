# Backend data and consistency declarations

P63a/P63b add optional `architecture.backend` to the existing design document. It is **design
semantics**, with no new runtime, SQL, migrations or application generation. Existing designs
omit it and retain their existing resources/contracts. **P63 is complete**, including bounded queries
and the read-only legacy adapter. Finite policy definitions follow in P64; authoring controls follow
in P67a.
See the [shared contract](plans/backend-benchmarks/contract.md#3-one-authoritative-model) and
[exact assignment split](plans/backend-benchmarks/execution-units.md#mandatory-splits).

The schema is strict and versioned: `{schemaVersion: 1, entities: [], aggregates: []}`. At most
100 entity versions, 50 aggregate versions and 100 query versions are allowed. Optional `queries`
preserves older P63a backend objects without adding an empty array. Definitions use `{id, version}`;
local fields, relations, constraints and invariant IDs stay scoped to their enclosing definition.
No catch-all configuration, SQL string or expression language is accepted.

## Entity authority and identity

An entity has `id`, `version`, `name`, a stable `dataset`, an exact `contract`, `storageId`,
`fields`, `primaryKey`, `scope`, `relations`, `uniqueKeys` and `indexes`. It references an existing
dataset and exactly that dataset's data-contract version. The dataset remains the authority for
its one owning application and relational store; components resolve to their application's identity.
There is no second editable type schema in the entity. Source-backed legacy resource contracts
cannot acquire editable entity copies. The read-only adapter described below supplies their derived
projection.

Each top-level payload field has one annotation:

```json
{
  "field": "revision",
  "storageId": "revision-column",
  "required": true,
  "nullable": false,
  "storage": { "kind": "scalar" },
  "serverOwned": "version"
}
```

Field IDs select the exact contract, including resolved local type references. `required` and
`nullable` must agree with that contract; optional absence remains distinct from a nullable value.
Every payload field is annotated once. Names are labels; entity/dataset/aggregate/contract display
renames preserve table and column IDs. Wire field names are part of the exact contract: changing
them requires a successor contract version, while stable field IDs can retain their columns.
Atomic edits cannot retarget an existing entity's dataset/table or rename an existing field's
physical column. Coexisting entity versions preserve those identities as well. These guards
declare identity, rather than supplying an executable database migration policy.

Table IDs are unique within a store across distinct entities; column IDs are unique per entity.
One dataset cannot acquire two independent entity schemas. Primary keys have 1–10 required,
nonnullable scalar fields. A scope is `{kind: "global"}` or `{kind: "field", field: "scope-id"}`;
a persisted scope key is a required, nonnullable, server-owned UUID. Tenant authority requires it.
Public authority is global; undecided dataset tenancy remains a saveable compilation gap.

`serverOwned` has the finite values `id`, `clock`, `principal`, `scope`, `version`. They require
respectively a UUID primary key, UTC timestamp, principal UUID, selected scope UUID, or bounded
nonnegative integer. All are required/nonnullable. This records server authority; commands will
bind actual trusted context and reject client overrides in their separately assigned packages.

## Storage and relational constraints

| Storage | Supported declaration |
| --- | --- |
| `scalar` | UUID, bounded text/enum, boolean, UTC timestamp or bounded safe signed integer |
| `json` | Explicit `{kind: "json", query: "opaque"}` with a fully bounded resolved schema; no relational interpretation or JSON query language |
| `money` | An exact two-field object: required bounded integer minor units and a required enum of uppercase three-letter currency codes; select nested stable field IDs using `minorUnits`/`currency`, with a separate `currencyStorageId` |

Money uses the entity annotation's `storageId` for the amount column. JSON maps, arrays and unions
retain their contract bounds. A missing type/bound remains an explicit `CONFIG_REQUIRED` readiness
error where the contract itself is an unfinished draft. Unsupported concrete storage types and
contradictory mappings are structural errors. No serializer or arithmetic runtime is supplied.

Unique keys declare `fields`, `scope` (`global`/`entity-scope`) and null semantics
(`distinct`/`not-distinct`/`forbidden`). An entity-scoped key includes the persisted scope field
before its named fields. `forbidden` rejects optional/nullable fields. Indexes list 1–10 scalar
field IDs with `asc`/`desc` order. Each entity has at most 30 relations, 30 unique keys and 30 indexes;
their IDs are locally unique.

A relation declares exact `target`, ordered `{source, target}` field pairs, `many-to-one` or
`one-to-one`, `reference` or `owned`, scope and delete behavior. Fields must have matching scalar
types/bounds; the target tuple must be a complete primary/unique key. One-to-one also requires a
unique source tuple. Relations stay within one authority/store. Many-to-many uses a separate join
entity. Same-scope links carry the scope field into the target key; `global-target` explicitly
selects a global entity. `cascade` requires owned-child intent. `set-null` requires nullable,
non-key foreign-key fields, retaining a shared trusted scope key. `restrict` is also available.

## Aggregates and finite strategies

An aggregate selects an exact root, up to 30 distinct children, one owner and one store. Every
participant's dataset must agree with that application/store; cross-store atomicity is rejected.
Children share root scope semantics and follow explicit owned-relation paths to the root.
An entity cannot belong to distinct aggregate boundaries. A worker may later execute the owning
module; the model does not make it a second data authority.

Concurrency is one of:

- `optimistic`, selecting a server-owned nonnegative integer revision field on the root. The
  later command declaration must require expectedVersion; this model does not execute CAS.
- `row-lock`, naming every participant once in lexical exact-identity order and selecting
  `order: "entity-id-primary-key"`. Composition remapping re-sorts changed identities. Actual
  row selection and lock execution belong to the later compiler/runtime.

At most 20 named invariants use these finite strategies:

| Strategy | References and constraints |
| --- | --- |
| `required-child` | Exact direct owned child/root relation and ordered count bounds, 1–1000 |
| `nonnegative` | Required bounded integer field on an aggregate participant |
| `field-comparison` | Two compatible required scalars; `eq`, or integer/timestamp `lte`/`gte` |
| `inventory-balance` | Nonnegative root stock and child reservation quantities through a named owned relation; intent to keep summed reservations within stock |

Review explicitly reports these strategies as unimplemented. Nonempty backend declarations keep
a raw `NEEDS_TEMPLATE` error so the legacy generator cannot silently ignore them. Supported-shape
matching and pure compilation follow in P69/P70; no current invariant/lock implementation or
benchmark acceptance is claimed. Synthetic offline tests model topic/first-post, stock/reservation
and ticket/article boundaries; they are separate from the later full benchmark designs.

## Bounded query declarations

A query has an exact `root` entity, `joins`, `filters`, `projection`, `order`, `limit`, `cursor`,
required `accessPolicy` selection and required `freshness`. It declares permitted reads; it does
not execute a database request. The reserved local source alias is `root`. Joined sources have
local alias IDs; `{source, field}` always selects a stable field ID from that source's exact contract.
Output/filter IDs, aliases and relation IDs never become outer composition identities.

- At most three joins follow already declared forward many-to-one/one-to-one relations. Each
  names an earlier `from` alias, relation ID and `inner`/`left` kind. Inverse/fan-out, repeated
  paths, arbitrary join conditions and forward/cyclic alias dependencies are rejected. Chained
  left joins preserve nullable result semantics. Relation authority, scope and target-key checks
  are shared with entity validation, so a query cannot introduce a cross-store join.
- Up to 20 distinct filter fields allow explicit comparison choices: `eq`, `ne`, `lt`, `lte`,
  `gt`, `gte`, `in`, `is-null`, `prefix`. Inputs inherit logical types/bounds from the exact
  contract; no second parameter schema is edited. Selected filters combine by conjunction.
  Ordered comparisons require integer/timestamp, prefix requires bounded non-enum text, and
  null checks require nullable/optional or left-joined data. `in` requires `maxValues` 1–100;
  other comparisons cannot carry that bound. Query values are data, never SQL patterns or code.
- Projection explicitly names 1–100 output IDs and fields, including bounded opaque JSON or exact
  money as a whole value. Filters, ordering and cursors require scalar storage. Nested JSON
  traversal, aggregates/count expressions and raw SQL are outside this vocabulary.
- Ordering has 1–10 distinct required nonnullable root scalar fields and fixed directions.
  Its suffix is a complete primary/unique key; scoped keys include their persisted scope field.
  A nullable unique key cannot establish a tie-breaker. `cursor: {kind: "keyset", fields: [...]}`
  must repeat the full order exactly. Join columns, offset cursors and client-selected order are
  unsupported. Cursor values will be validated by the later compiler/runtime; they never grant
  authority or replace current access checks.
- `limit: {default: 25, maximum: 100}` sets positive bounds through 100. Omitting `default` selects
  25; a smaller maximum requires a correspondingly smaller default. No unbounded bulk-read escape
  exists. Request parsing, SQL pagination and token encoding follow in their runtime packages.

`accessPolicy` is required. `{kind: "unresolved", reference?: {id, version}}` is a saveable
`CONFIG_REQUIRED` compilation gap retaining an intended exact policy identity. A claimed
`{kind: "policy", reference: {id, version}}` must resolve a real definition: until **P64** adds
`accessPolicies`, it is an actionable `UNKNOWN_REFERENCE` structural error. P63b deliberately
supplies no permissive policy stub or inferred authorization. P64 must replace that unavailable
definition check with exact finite-policy resolution and scope/projection checks. Access must
apply before joins, filters, pagination, counts/snippets and projection, including joined data;
stale data/cursors cannot establish current authorization. All new backend intent retains its raw
`NEEDS_TEMPLATE` blocker independently of this saveable policy gap.

`freshness: {kind: "authoritative"}` reads the root authority. A declared stale read uses
`{kind: "bounded-staleness", binding, maxAgeSeconds}` (1–31,536,000 seconds), referencing the
existing named **read** binding and its root's **exact data-contract version**. Its existing
freshness policy must state a TTL/on-write/event-driven bound no greater than the query maximum.
Missing bindings or contradictory concrete choices are structural errors; unfinished policy
choices remain blocking readiness. The binding reference survives extraction and remapping;
there is no duplicated editable freshness policy. These are declared bounds, not measured cache
behavior or permission to cache authorization.

## Read-only legacy resource adapter

`readLegacyBackendResources(design)` derives deterministic, detached, deeply frozen resource views
and source-addressed findings. Each view retains its `{element, attachment, resource}` source,
exact selected template, store connection/store, existing resource descriptor, source data-contract
references, implicit system-field selectors and `legacy-owner`/`legacy-internal` access semantics.
The descriptor is the parsed authoritative `Resource`, retaining its field types, optionality,
relations and operation allowlist. It is not converted to an editable `BackendEntity`. Implicit
`id`/`ownerId`/`createdAt` selectors stay separate from authored local field IDs. Physical legacy
names remain the existing emitter's responsibility; this helper does not copy its hashing or SQL.

Invalid resource models report `CONFIG_INVALID` and produce no fabricated views; unresolved stores
report `CONFIG_REQUIRED`. Reading the adapter never adds `architecture.backend`, rewrites saved
contracts, changes resource generation or creates competing session tables. The backend schema
rejects attempted editable entities backed by source resource contracts. Explicit migration, new
query authoring against legacy sources and runtime execution remain separately assigned work.

## Editing and portability

Existing `setArchitecture` batches carry the complete model and reject new structural findings
atomically. `validateBackendData` and `backendDataRemovalFindings` report source paths under
`architecture/backend/entities/<id>@<version>` or `aggregates/<id>@<version>`. Removing an authority,
store, field or aggregate participant leaves an actionable finding at its declaration. Referenced
exact data contracts cannot mutate/disappear even during same-batch consumer removal or migration;
explicit successors preserve old definitions.

Library extraction follows dataset/contract/owner/store/relation/aggregate dependencies. Insertion
maps outer graph identities and exact references while retaining local field/relation/invariant,
table and column IDs. Exact pinned whole-boundary reuse retains the existing dataset/entity graph;
partial reuse still checks conflicts. Target diffs include exact backend versions. Dataset review
fingerprints include participating entities/aggregates/queries, joined datasets, freshness bindings
and related data contracts. Full handoff
fingerprints, operation JSON Schema, portable JSON and Markdown preserve the declarations.

No offering, reusable C1/C2/C3 boundary or template availability changed, so CATALOG is unchanged.
The frozen benchmark contracts/expectations and legacy resource schemas remain authoritative.
