# Local reusable contract types (P62a)

Contracts can describe reusable logical types, bounded dictionaries and tagged outcomes. These
are design semantics. They add no serializer, storage mapping, runtime/template availability or
benchmark implementation evidence. Transport, binary descriptors and the combined portable schema
export gate belong to **P62b**; mouse authoring follows in P67a.

The optional `architecture.contracts[].shape.types` array contains at most 100 definitions:
`{id, version, name, description, value}`. `value` uses the same schema as nested contract fields.
An exact reference is `{type: "ref", ref: {id: "money", version: "v1"}}`. References resolve only
inside that exact contract's shape. No remote fetch, name matching or inferred version upgrade
occurs. A field's stable identity and `required` flag remain on the field using the reference.

Keeping definitions inside the contract preserves one authority for wire/logical types. Extraction,
insertion and pattern role mapping copy the complete shape and remap the outer contract identity;
local type/field IDs stay local. Handoff, target diffs, review/scenario inputs and design fingerprints
carry the original definitions and references. Chat's operation JSON Schema exposes the same fields.
No new global type collection or second editable schema is introduced.

The added value shapes are:

| Type | Properties | Meaning |
| --- | --- | --- |
| `ref` | `ref: {id, version}` | Exact local definition; no inline overrides other than adding nullability |
| `map` | `keys: {minLength?, maxLength}`, `values`, `minEntries?`, `maxEntries` | String-keyed dictionary; finite key length and entry count; at most 10,000 entries |
| `tagged-union` | `discriminator`, `variants` | 2–20 object variants; each has a required, nonnullable text field named by the discriminator with exactly one unique literal in `enumValues` |

Variants and discriminator fields may themselves use exact local references. Optional field presence
and nullable values are independent: an optional nullable address can be absent or explicitly null;
a required nullable address must be present. A reference may add nullability, but `nullable: false`
cannot remove nullability declared by its target.

Incomplete declarations can remain structured drafts: a reference without a selection, a map missing
bounds/value type, a union missing variants, or explicit `unresolved` values. A union always names
its discriminator. Drafts produce `UNRESOLVED_CONTRACT` review findings, fail strict resolution and
cannot establish compatibility for reusable-definition matching. A selected but nonexistent type
version, duplicate type identity, cycle, invalid/overlapping tag or exceeded budget is a structural
error; an operation batch introducing it saves nothing. Known scalar/nonliteral/optional/nullable
discriminator variants are invalid, rather than unspecified alternatives.

[`contract-type-resolution.ts`](../packages/spec/src/contract-type-resolution.ts) provides the pure
helpers. `inspectContractShape` checks every definition, input, output and outcome payload, including
unused definitions. `resolveContractValue` expands the selected value in memory and returns no value
if any problem remains. Both detect cycles and count repeated expansions of shared definitions;
the limits are **2,000 total visited nodes** and **depth 20**, with smaller caller budgets allowed.
Stored inline nesting retains the existing five-level and forty-fields-per-object limits. Sharing
an acyclic type is allowed; recursive runtime types are unsupported. No saved reference is expanded
or silently truncated.

A referenced local definition's value is immutable even in an otherwise unconsumed contract draft,
and even if the same batch removes/migrates its uses. Its enclosing contract cannot be removed to
bypass that protection. Definition display name/description changes preserve identity. To change a
value, retain the old `{id, version}` and add an explicit successor; if the contract already has
interface/binding/dataset consumers, create a new contract version and deliberately move consumers.
Unreferenced type drafts remain editable. Adding no `types` field preserves existing nested-contract
serialization; no saved project is automatically migrated.

Focused semantic and compatibility examples are in
[`contract-types.test.ts`](../packages/spec/src/contract-types.test.ts). The history dictionary,
tagged payment result, reused money and optional nullable address are synthetic design fixtures;
the independent frozen D/V/Z contracts and expectations remain untouched.
