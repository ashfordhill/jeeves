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
| `owner` | A persisted UUID field compared with the current session principal ID |
| `membership` | An active persisted organization/resource/group membership, matched by principal, scope and a declared direct relation |
| `visibility` | A boolean or exact enum value on the protected entity; public access is explicit |
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

Private category access is represented by active group membership through the article/topic's
category relation. Internal article access adds the persisted agent role; a customer policy instead
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
semantics remain unchanged. P67b supplies policy mouse authoring; P69/P70 supply implementation
matching/pure compilation, and P76 supplies runtime enforcement under a separate assignment.

[P65 command/lifecycle declarations](backend-behavior.md) reuse these policies for root/child
writes, current output observations and authorized replay. Existing exact operation access bindings
must agree; policy versions referenced by operations remain immutable through consumer removal.
