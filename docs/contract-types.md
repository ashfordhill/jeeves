# Reusable contract types and transport (P62)

Contracts can describe reusable logical types, bounded dictionaries and tagged outcomes. These
are design semantics. They add no serializer, storage mapping, runtime/template availability or
benchmark implementation evidence. **P62a and P62b are complete**, including bounded HTTP/binary
declarations and portable logical JSON Schema export. Mouse authoring follows in P67a.

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

## HTTP mappings and binary bodies (P62b)

An API operation may declare `transport` using the strict
[`contract-transport.ts`](../packages/spec/src/contract-transport.ts) schema:

```json
{
  "protocol": "http",
  "method": "GET",
  "path": "/files/{fileId}",
  "parameters": [{"field": "file-id", "in": "path", "name": "fileId"}],
  "responses": [{
    "outcome": "downloaded",
    "status": 200,
    "headers": [{"field": "disposition", "name": "Content-Disposition"}],
    "body": {"kind": "binary", "contentType": "application/octet-stream", "maxBytes": 1048576}
  }]
}
```

The IDs above select fields in the operation's input/output or selected outcome payload; this
example assumes required scalar `file-id` input, scalar `disposition` output and `downloaded`
outcome. A response without `outcome` selects `operation.output`. An outcome uses its explicit
`payload`, or the shared output when no payload is declared. Each outcome needs a response; each
status/output/outcome maps once. Explicit outcome status must agree with the response. Success
uses 2xx/3xx and rejection/failure uses 4xx/5xx. Informational responses are outside this model.

`parameters` select top-level input IDs with `in: "path" | "query" | "header"` and an explicit
wire name. Path placeholders occupy whole segments, have unique names and select required,
nonnullable scalars. Query/header fields also resolve to nonnullable scalars, with field presence
remaining required or optional. Structured data uses a JSON body. Header names compare without
case; other names compare exactly. Repeated fields, conflicting names, missing fields, unmapped
logical fields and equivalent method/routes within one contract reject the whole operation batch.
Absolute routes allow bounded literal segments and `{parameter}` segments, without query strings,
dot segments or empty segments. GET/HEAD have no request body; HEAD and 204/205/304 have no response
body. Transport declarations belong only to API contracts.

Optional `request` and response `body` use one of two distinct descriptors:

- `{kind: "json", contentType: "application/json", fields: [...]}` selects logical field IDs,
  preserving their names, constraints, nullability and presence. `application/*+json` media types
  are also supported. Every logical field maps exactly once between parameters/headers and body.
- `{kind: "binary", contentType: "image/png", maxBytes: 1048576}` describes raw bytes outside
  the JSON value system. `maxBytes` is an integer from 1 through 1,000,000,000 and the content type
  is a concrete media type without parameters or wildcards. This descriptor supports upload and
  download intent; no byte string, base64 coercion, streaming implementation or inspection is
  supplied. Metadata can still use logical parameter/header fields.

Content-Type and Content-Length cannot also be mapped as logical headers: the body descriptor
owns those declarations. Names are bounded to 64 characters, route paths to 500, media types to
120, parameter/header/JSON field lists to 40, and responses to 31 (30 outcomes plus shared output).
These declarations remain optional for old contracts and logical-only drafts. No source-backed
legacy contract acquires a competing planned shape or transport mapping.

Source references retain their authority. Editing a captured source identity, snapshot or revision,
or replacing its exact version with a planned shape, is rejected even without consumers. Capture
an explicit successor version instead. Underlying legacy resources remain editable through their
existing source path; changed/removed sources continue to produce stale review findings. Consumed
transport versions cannot be removed while migrating consumers in the same batch. Legacy
composition/removal behavior and frozen nested/source serialization remain unchanged.

## Portable logical JSON Schema

[`exportContractJsonSchema`](../packages/spec/src/contract-json-schema.ts) returns either
`{ok: true, schema, issues: []}` or `{ok: false, issues}` with no partial schema. It first checks
the strict contract, all types (including unused definitions), cycle/expansion budgets and every
transport mapping. Unresolved drafts, missing exact versions, invalid tags/mappings and excessive
graphs cannot become apparently usable schemas. Source references return `SOURCE_REFERENCE`;
their existing authoritative definitions remain in handoff, without inferred second schemas.

The result is a self-contained JSON Schema draft 2020-12 catalog. `$defs` contains stable keys
such as `type.money@v1`, `operation.pay.input`, `operation.pay.output`,
`operation.pay.outcome.rejected`, `operation.pay.request` and `operation.pay.response.0`.
Stored exact references remain local `$ref` links; no remote fetch or recursive runtime type is
introduced. Shared versions stay shared, and display renames retain the same schema identities.

Data/event documents select `#/$defs/payload` as their root instance schema. API/in-process
documents are catalogs of several message schemas, without an invented message envelope; select
the input/output/outcome/body reference from `x-jeeves.operations` before validating an instance.
An API catalog's unselected root is not a request validator. Its metadata includes exact contract
identity and transport method/path/status/content mappings; scalar parameter/header entries also
include required presence and schema references. Binary descriptors stay descriptors and never
masquerade as JSON strings.

Objects reject undeclared properties and express presence through `required`. Nullable references
add a null alternative without removing target nullability. Maps carry key-length and entry-count
bounds, arrays retain item bounds, and tagged outcomes use disjoint `oneOf` variants. No runtime,
storage mapping, parser implementation or template availability follows from a valid schema.

Handoff JSON keeps the intact typed `definition` and adds `jsonSchema`, or `schemaIssues` for an
incomplete definition. Typed names, literals and HTTP routes stay exact, including names such as
`config` and route prefixes such as `/home/`; opaque runtime configuration and source example/
default values retain the existing sanitization. Extraction/insertion, exact definition reuse,
target diffs, fingerprints and chat operation schemas carry the same original references/mappings.
The offline [transport/export tests](../packages/spec/src/contract-transport.test.ts) validate
exported instances with Ajv, including dictionary bounds, money reuse, tagged payment results,
optional nullable addresses, source protection and binary downloads. Ajv and its formats package
are test-only dependencies pinned to the versions already used by the legacy REST runtime.


## Mouse authoring

P67a exposes local type definitions, exact version references, bounded dictionary keys/entries/values
and tagged-union discriminators/variants through the existing Interfaces and component Data dialogs.
The controls share one local type scope with payloads and operation inputs/outputs. **Open exact type
definition** selects the referenced version. Referenced shapes stay protected by the same transition
guards used by atomic saves; successors preserve old versions and require explicit reference selection.
Unresolved values are displayed as design decisions. Optional presence and nullable value remain
separate controls. Maps/unions retain their existing depth/count/validation budgets; no JSON/code
textarea or new serializer/runtime was added. See the [studio workflow](architecture-studio.md).


P71a adds optional named `textConstraint` presets: email, lowercase SHA-256, error code,
correlation ID, base64url cursor, base64 bytes and URI. These finite protocol choices retain exact
frozen REST payload constraints without an arbitrary regular-expression editor. They apply only
to text; omitted properties preserve old documents. UUID and UTC timestamp logical schema exports
now include their canonical pinned Zod format patterns. Contract editor selection, exact-version
protection, fragments, fingerprints and portable JSON Schema carry the constraints; no serializer,
OpenAPI interpreter or runtime validation path is generated by this addition.

## P71b logical transport distinctions

A response may name bounded `outcomeAliases` with the same exact kind, payload and status: for
example HTTP503 unavailable/failed/cancelled, or HTTP200 changed/unchanged. Each identity maps once.
An explicit payload-free `noResponse` outcome requires Failure, Unknown and Reconcile first with no
status; it represents lost observation, not a guessed HTTP error. A payload-free committed `internal`
checkpoint has no status/response mapping and is not a public success route. These distinctions leave
the frozen REST request/response schemas unchanged. P71a's exact v1 definitions remain preserved;
current v2 successors add the clarified logical semantics.

Typed session delegation identifies register/login/logout/readSession at the existing session owner,
with no public grants, Origin/CSRF, durable opaque hashing and application isolation. It does not add
a domain account/session table or select an unavailable implementation implicitly.
