# Finite backend access policies

P64 extends the optional backend model with exact, versioned `accessPolicies` and
`accessBindings`. These are design declarations and validation only. They provide no authorization
runtime, credentials, SSO, generated application, policy evaluation or observed benchmark evidence.
P63's [data/query model](backend-data.md) and existing session principal remain authoritative.
The [shared contract](plans/backend-benchmarks/contract.md#access-and-context) fixes the intended
meaning; [P64](plans/backend-benchmarks/phase-2-design.md#p64) is its bounded implementation scope.

## Authority and rules

Each policy protects one exact entity version. Its context explicitly selects public access, the
existing session principal, or a verified service identity. Authentication kind and correlation are
server established. `authorized-scope` means the server has authorized the selected workspace or
organization and applies that scope to the resource and persisted role/membership rows before rule
composition. It must match the entity's persisted scope field; a global policy cannot bypass it.
Neither a route parameter nor a raw header/body/queue payload establishes that context. Existing
`Principal.id` is reused; this model supplies no second account/session schema or role inference.

Policies have at most 20 named clauses and 20 rules. A rule selects finite named actions and an
`all`/`any` condition over at most 20 clause IDs. Conditions cannot reference rules or traverse a
recursive expression/relationship graph. The fixed default is deny, and any matching deny rule for
the action wins over every allow. Context identity/scope/purpose checks are mandatory gates outside
the condition; a disjunction cannot bypass them.

| Clause | Explicit authority/meaning |
| --- | --- |
| `authenticated` | The selected server-established session or service identity |
| `role` | Named enum values from an exact persisted role entity, matched by session principal and current scope |
| `owner` | A persisted UUID field on the resource or one named direct parent compared with the current session principal ID |
| `membership` | An active persisted organization/resource/group membership, matched by principal, scope and a declared direct relation |
| `visibility` | A boolean or exact enum value on the protected entity or one named direct parent; public access is explicit |
| `group-grant` | Current workspace membership AND explicit public category or a grant joined to active membership in the same exact group |
| `action` | Membership of the requested action in a bounded named allowlist |
| `service-purpose` | The exact purpose from a verified server service identity |

Role and membership sources must share the protected entity's application authority, relational
store and scope semantics. Principal fields are required nonnullable scalar UUIDs; role fields are
required enums and active membership is a required boolean. Membership follows its declared
relation to the protected resource, or one forward to-one `via` relation from that resource to its
group/organization. Relation keys, logical types, stores and scope propagation also pass P63's
checks. Many-to-many access uses an explicit membership entity. No recursive traversal or arbitrary
SQL/JavaScript condition is accepted.

## Fields, query observations and effect sites

Read visibility and allowed writes are separate projections. Each projection has a local ID,
`read`/`write` mode, bounded entity fields, a named clause condition and fixed `unknownFields:
"reject"`. The policy must authorize the action before its projection condition can permit fields;
neither the projection nor a successful prior request grants access. Write projections cannot
accept server-owned identity, scope, clock or version fields. The eventual runtime must reject
unknown writes; enforcement remains deferred.

P63 queries retain `accessPolicy`; they now select `accessProjection` and optionally `accessSite`
(`read`, `search`, `export`; absent means read/list). Query actions are respectively `list`,
`search`, `export`. Every joined source needs its own exact `sourcePolicies` selection, including
sources used only by filtering/counts rather than returned fields. Projection coverage includes
output, filters, ordering and cursor fields. Access applies before joins, filtering, pagination,
counts and output. A cursor is validated data, never authority. A missing projection/recheck/allow
action is a readiness gap, and an unknown explicit selected policy or projection is structural.

`accessBindings` bridge exact contract operations and sensitive entity projections to the same
policy identities. An operation binding selects its exact provided contract/operation and owning
application/component; it must share the protected entity's application authority. A sensitive
projection binding lists its exact entity fields. Bindings select a named action, field projection
and recheck site. This small additive collection separates access selection from P65's future
command/transaction semantics; it does not implement those commands. Duplicate target/site/action
selections are rejected. Operation output-to-entity value mappings remain P65/P70 work.

Revocation has fixed `current-state` semantics and no authorization cache. Recheck sites are read
(including list), write, search, bytes, materialization, delivery, export, job and idempotent replay.
Each declared use requires its site in the exact policy's recheck list. Replay authorization occurs
before returning a stored response; an old receipt supplies no grant. Background work selects an
explicit server service purpose with bounded authorized-scope or selected-resource scope, and an
initiating actor is fixed to `provenance-only`. Service work does not borrow that actor's old roles.
Actual enforcement, SQL placement, concurrent revocation and receipt/byte handling remain later
runtime responsibilities.

Private category access uses a current grant joined to active group membership through the
article/topic category; P71a adds the exact finite predicate below. Internal article access adds the persisted agent role; a customer policy instead
requires ownership and public article visibility. Shop-admin rules select a persisted role and a
separate write projection. The synthetic offline tests represent these decisions without creating
any of the three benchmark applications or awarding implementation points.

## Drafts, review and portability

An unresolved policy selection may retain its intended exact identity without that definition
existing. Empty rules/projections/recheck lists remain editable, default-deny drafts with actionable
`CONFIG_REQUIRED` findings. Detached prose cannot satisfy selection. Bad exact references, field
types, scope/ownership contradictions and recursive paths reject operation batches atomically.
Once an exact policy is selected, its semantics are immutable even if the same batch removes or
migrates consumers. Preserve it and add a successor version; its display name remains editable.

An optional `relationshipBinding` connects an access use to existing broader relationship intent.
Explicit identity/tenant contradictions appear as `BACKEND_ACCESS_CONFLICT` in Review, with the
binding/dataset inputs and an actionable explanation. Intent remains separate and cannot grant
executable access. Missing access decisions appear as `BACKEND_ACCESS_GAP`. Relevant dataset
fingerprints include the policy graph so acknowledgements expire after access changes. Conflict
findings cannot be acknowledged away as unresolved advice. Runtime availability remains blocked.

Shared collection/reference helpers carry policies and bindings through removal findings, exact
contract protection, fragment extraction, ID remapping, whole-boundary reuse, target diffs,
operation JSON Schema, deterministic JSON/Markdown handoff and fingerprints. Outer graph references
remap; local clause/projection/action/field/relation IDs and physical storage identities do not.
Legacy backend models gain no empty policy collections, and legacy owner CRUD/session/resource
semantics remain unchanged. [P67b](architecture-studio.md) supplies policy mouse authoring, exact sensitive-path selections,
affected-use navigation and a labeled local design preview; P69/P70 supply implementation
matching/pure compilation, and P76 supplies runtime enforcement under a separate assignment.

[P65 command/lifecycle declarations](backend-behavior.md) reuse these policies for root/child
writes, current output observations and authorized replay. Existing exact operation access bindings
must agree; policy versions referenced by operations remain immutable through consumer removal.

## Authoring and discovery (P67b)

Use **Configure component → Access** to choose or add an exact policy. Focused sections cover
trusted context, seven finite clause kinds, all/any allow/deny rules, separate read/write projections
and all nine current-state recheck sites. Policies reuse persisted entity fields and declared
relations. A protected referenced version can be renamed; changing its semantics requires a
successor, with deliberate consumer retargeting. No successor silently updates consumers.

The affected-path inventory is shared by the UI and chat discovery. It shows root/joined query
uses, including hidden filter/order/cursor fields; sensitive byte/output access uses; command
access participants; and typed capability settings. An unresolved intended exact identity is
labeled separately from a selected policy. Query/access-use navigation returns to the same
component draft. Existing provided operations expose exact read-only input/output inspection.

The local synthetic fixture illustrates named-clause composition, mandatory context/current-state
gates and deny precedence. Its assumptions are explicit and unsaved, with unknown facts retained.
It denies missing declared recheck sites and withholds fields for incompatible read/write modes.
It does not evaluate persisted rows, authenticate a principal or prove enforcement. The shared
Save/Cancel, schema validation, revision conflicts and single-step history apply to the whole
Data/Access draft. Parent P67 is complete; P68a is the next authoring work unit.


## P71a bounded access corrections

The Discourse foundation exposed P64 vocabulary missing from its synthetic direct-membership case.
`group-grant` explicitly selects exact workspace-membership, category-grant and group-membership
entities. It selects their principal/active/access fields and grant/category/group relations.
At most three named nonnullable forward to-one resource relations reach the protected category;
there is no policy recursion, reverse-path inference, SQL or arbitrary expression. Every entity
shares the resource application, relational store and authorized scope. The grant and membership
must target the same group; active and access tests use exact declared boolean/enum values.
Public-category access still requires current workspace membership. A service selects a persisted
recipient UUID field and current recipient memberships; an initiating session cannot supply it.

Owner and visibility clauses can select one explicit same-scope parent relation. Read projections
can contain bounded conditional field rows: reveal the field when any listed existing all/any
condition is true, otherwise return `null` or omit it. Unknown facts do not reveal it. Null requires
an already nullable logical field; omission requires an optional field. Conditions cannot change
write projections or bypass action/default-deny/deny-wins gates. This preserves post tombstones
while redacting hidden/removed text, and keeps retained revision authority nonnullable.

Mouse controls expose exact joins, subjects, current memberships, conditional fields and named
clause groups. The local synthetic preview lists redactions separately from disclosed fields.
Schemas, extraction closure/remapping, immutable exact versions, handoff, fingerprints, chat and
pure compiler plans carry these declarations. They are not production authorization evaluation.

P72a permits a visibility clause to select **null on an explicitly nullable scalar**. A single
forward same-scope parent relation may have nullable key fields; an absent parent never satisfies
its field predicate. This is a bounded association check, not recursive traversal. The Vendure
asset policy permits a published product's unassociated asset through explicit `variant-id=null`,
or its associated asset through that exact published variant. A compound product/variant/shop
relation prevents borrowing another product's publication. Existing owner clauses still require
nonnullable parent ownership. Null on a required nonnullable field or an undeclared arbitrary
value is invalid. These are design declarations; the synthetic preview uses assumed facts.

Mouse value selectors retain typed boolean, enum text and null values separately; the text enum
`"null"` does not become a null association when saved.
