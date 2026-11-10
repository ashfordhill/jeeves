# Studio blueprint

The blueprint is the part of a design that a code generator reads. The
[experimental generator foundation](../jeeves-generator/README.md) validates saved explicit v2 generation source and assembles in-memory bundles from installed
implementations. It also retains the exact frozen local-v1 profile and its 19 experimental
template families. The canvas previews/downloads the selected source; unsupported designs refuse
without substituting a frozen baseline. The active
[field-project plan](plans/reliable-foundations/youtube-field-project-plan.md) keeps the package
separate from the studio; its partial report grants no strict readiness or runtime credit. The studio writes
through operations; the blueprint is derived on every request and is never stored or edited.

The new default `studio-tinyurl-foundation@1.0.0` stores complete schema-v3 declarations. Its
default v2 export deliberately refuses exact scope/ownership/operation loss; request
`?version=3` for the full study and report. The extended `studio-tinyurl@3.2.0` stays schema2
with its prior v2 meaning. Creating either study is a single complete seed/history edit.

Canvas selection, its line highlight and Fit are view state. They neither filter this endpoint
nor change the design revision: the blueprint always includes every saved relationship.

```text
studio (operations) ──▶ design document ──▶ designBlueprint() ──▶ GET /projects/:id/blueprint ──▶ jeeves-generator (selected-source v2 or exact frozen-v1 preview/ZIP)
```

## Installed feature authoring

Normal mouse and chat actions use `buildSupportedAuthoringCommand` with the executing registry
reported by `GET /generation-support`. Normal `attachGenerationPreset` selects video and delegates to
`buildGenerationPresetCommand`: graph, modules, generation and ownership save in one batch. A
legacy source upgrade is explicit in the mouse preview. Useful supported settings reuse existing
source fields; TTL and concurrency mirrors update atomically. No parsing/reload migration occurs.

Blueprint v3 retains all original settings, custom requirements and generation declarations,
including unsupported preserved values hidden by the normal editor. Its generation resolver
still diagnoses unsupported transport/identity intent. New local connection creation explicitly
uses HTTP/Private network where applicable. Catalog presence or successful attachment is not
runtime verification. The experimental preview/ZIP route assembles this exact saved source
through the same executing registry, independently of strict TinyURL eligibility.

## Endpoint

`GET /projects/:id/blueprint` returns the blueprint JSON with `Cache-Control: no-store`: 404 for an
unknown project, 400 for a malformed ID or unsupported version query. The default remains v2; `?version=2` selects it explicitly and `?version=3` opts into v3. A v2 request returns 422 `UNSUPPORTED_BLUEPRINT_CONTENT` when persistent scope, explicit ownership/access or operation bindings would be lost: `requestedVersion`, `supportedVersion` and `unsupported[]` name every exact path and reason. It is a pure read and changes no revision, layout or
history. Behind the web proxy the same route is `/api/projects/:id/blueprint`.

## Source

- Schema: `designBlueprintSchema` in
  [`jeeves/packages/spec/src/studio-blueprint.ts`](../jeeves/packages/spec/src/studio-blueprint.ts).
- JSON Schema (draft 2020-12): `designBlueprintJsonSchema()`.
- Projection: `designBlueprint(design, projectName)`, pure and deterministic; every list is sorted
  by identity.

## Contents (`blueprint: 2`)

| Field | Holds |
| --- | --- |
| `revision` | The design revision it was read from. |
| `system` | System name and description (C1). |
| `actions` | What the user does: `{lane, name}`, at most one per lane, in lane order (`download`, then `upload`). `name` is the word on the action tile ("Watch"). A lane with entries but no stored action has its default one (Consume or Produce). Actions are design intent; they generate no code, and tell a generator's frontend templates which user flow each service serves. Empty for a design without actions. |
| `entries` | The tiles each action reaches directly: `{lane, action, element}`, `lane` being `download` or `upload` and `action` that lane's action name, sorted by lane then element. Empty for a design without lane entries. |
| `services` | Each studio application (service, browser, worker, billing, redirect, notification, identity, uploads, gateway): definition ref and status, settings, optional group, optional C1 context node, and its C3 `components` (kind, settings, purpose, typical third-party products, required link kinds). One service is one future deployable. |
| `resources` | Database, cache, queue, object store, search, CDN: definition, settings, optional owner. A store's owner is its only writer. |
| `externals` | External API elements (category, provider), plus C1 external systems that have no C2 element (`source: "context"`). |
| `groups` | Packages and their member services. |
| `connections` | Resolved C2 connections: typed `from`/`to` endpoints, action, protocol, interaction, security (the planned identity, such as `Service identity`), store access, channel use, timeout and retry. `access` is set on a link into a database, search index, cache or object storage: `write` when it comes from the store's owner (or a member of the owning package), `read` otherwise ([one writer per store](studio-settings.md#relationships)); it is derived from the owner, never stored. A queue link has `channelUse` (`publish` or `consume`) instead. C1 relationships with an external system that has no element appear with `source: "context"`. |
| `componentLinks` | A component's use of a sibling component or, through its `via` C2 connection, an element. |
| `omitted` | Anything that cannot be represented (`element`, `connection`, `component`, `component-link` or `entry`), with a reason (`no-studio-binding`, `endpoint-outside-blueprint`, `host-not-a-service`). Nothing disappears silently. |
| `findings` | Validation findings at this revision. Readiness gaps are `CONFIG_REQUIRED`. Design warnings, designs that look wrong but are allowed (a store with no writer, a worker's output nobody reads, a queue with no publisher or consumer, an action with no entries, Uploads without a storage relationship, a worker without any outgoing relationship), are `DESIGN_WARNING` with `severity: "warning"`; they never block an edit ([warnings](studio.md#warnings)). The shape is unchanged; the new code is additive within version 2. |

It leaves out layout, presentation, history and UI state. People are not included; they are not
generated.

## Contents (`blueprint: 3`)

`designBlueprintV3()` and `designBlueprintV3Schema` provide the explicit v3 projection;
`designBlueprintV3JsonSchema()` exposes its JSON Schema. It retains the v2 graph/settings fields
and adds:

| Field | Holds |
| --- | --- |
| `sourceSchemaVersion` | The stored document's 2 or 3. Reading/exporting never upgrades it. |
| `scope` | Exact nullable profile reference, finite included/excluded requirements with criticality, and up to eight unresolved custom requirements with optional element/connection targets. Requirements sort by feature, custom requirements by ID. Unknown well-formed profile versions remain unchanged. |
| `profileStatus` | `known`, `unresolved` or `unspecified`; known means the scope record exists, never that its contracts are implemented. |
| `unresolvedRequirements` | Namespaced `source` (`profile`, `requirement`, `contract`, `custom`), ID, requirement, criticality and optional targets. Includes unspecified legacy requirements, required incompatible behavior, missing contracts and unresolved custom behavior. Missing targets are diagnostic text; the stored original requirement survives. |
| `ownership`, `ownershipStatus`, `ownershipFindings` | Complete explicit owners, canonical element roles, source/projection authority, role grants and dependency requests, plus targeted unresolved/refused declarations. Rows sort deterministically; status is declared or unspecified, never verified. |
| `operations`, `operationCatalog`, `operationFindings` | Complete exact receiver/caller bindings, immutable local operation and cache-policy identities and targeted structural/readiness findings. Binding IDs are distinct from role/edge IDs; unknown refs remain unknown. [Finite contracts](studio-contracts.md). |
| `generation`, `generationFindings` (optional) | Schema3's exact runtime/preset/template selections, canonical targets and finite tagged bindings, detached without materializing absent declarations. Module-level selections, which the module commands derive, use the same fields: a component target, a lead's template, or `module-stub@0.1.0` with the binding `{kind: "module-stub"}`. Targeted source findings distinguish canonical contradictions and unavailable refs. Catalog presence installs nothing. [Actual interfaces](plans/reliable-foundations/youtube-v2/interfaces.md). |
| `legacyOwnership`, `roleMeaning` | Qualify preserved `resources[].owner` as inferred writer and services as canonical application tiles, which are not independent logical owners or necessarily separate processes. |
| `legacyAccess` | `inferred-from-ownership; not a declared operation grant`. Existing access values do not gain permission semantics. |
| `templateAvailability`, `runtimeVerification` | Both `none`. Selecting a profile supplies neither. |
| `readiness` | Shared snapshot report: full structural validity, exact contract completeness, implementation availability, exact-output evidence, separate generation eligibility, targeted blockers/advisories/limits, and complete canonical `composition.subject` with its domain/profile/digest. Product availability remains unavailable and evidence none. [Fields and trust boundary](studio-readiness.md). |

Stored schema v2 remains readable as-is and exports its identical v2 meaning. Explicit
`upgradeDesign` creates schema v3 plus `scope` in one operation; `setDesignScope` requires v3.
A schema-v3 design with no scope, ownership or operation rows and no generation declaration can still export v2 with legacy meaning. Profile,
each finite/custom requirement and every ownership/operation row cause v2 refusal with its exact source path,
including nonempty ownership with empty scope. Optional ownership is never added on read;
`setOwnership` / `setOperations` require v3. Optional operations are never added on read. Empty declarations add no meaning.

Optional `generation` is preserved exactly in v3, including unknown well-formed refs. V2 refuses
`generation.version`, `.runtime`, optional `.preset` and every `.selections[index]`; even an
explicit empty selection collection carries a runtime identity. `setGeneration` requires v3,
and `null` removes the optional field. Existing absent-generation source, blueprint and frozen
v1 output bytes remain unchanged. Present generation also changes the strict TinyURL subject
hash and blocks that finite composition; experimental selections supply no readiness credit.

A host may separately call the pure `resolveGeneration` API with exact installed consumer/output
identities; blueprint source findings remain conservative and install no implementations.
Normalized semantic support is separate from strict readiness and runtime verification.

V3 projects detached ownership rows as well as detached settings/scope/operations: changing the
returned object cannot change source declarations. Validator finding paths always address the
source document's row order, even where exported collections sort by identity. Do not use numeric
finding paths as indexes into sorted blueprint arrays or `readiness.composition.subject`.
Use the canonical tile/edge/owner/operation targets in readiness; fetch the source design when
interpreting an original validator path. Manifest composition-difference paths instead explicitly
start at `composition.subject` and address that canonical subject.
The mouse form reads the design, never the v2 blueprint, when editing these declarations.
Undo/Redo restore the complete original schema and declarations as a new revision.

The only known profile is `tinyurl-create-resolve@1.0.0`: one public namespace, immutable HTTP(S)
destinations, authenticated create, public resolve and optional expiry. Required custom slugs,
mutable destinations, disable/management, reputation, quotas or exact analytics remain visible
and block this narrow scope. Selecting it supplies no declarations; ownership completeness uses targeted NC02 findings. NC03/NC04 check exact Create/Resolve caller bindings, source/owner namespace agreement and positive-cache/expiry/settings intent, retaining targeted gaps and unknown refs. This is no readiness certification or implementation.

## Example

The [TinyURL study](studio.md#the-tinyurl-study) at revision 1 has two actions, three entries, four services
(`analytics`, `redirect`, `shorten`, `stats-api`) holding nine components, four resources
(`analytics-store`, `click-events`, `url-cache`, `url-db`), no externals, no groups, seven
connections, twelve component links, and empty `omitted` and `findings`. Each store has one
writer: `shorten-db`, `redirect-cache` and `analytics-write` write; `redirect-db` and `stats-read`
read. Its head, and three of its connections (a publish, a read and a write):

```json
{
  "blueprint": 2,
  "revision": 1,
  "system": {
    "name": "TinyURL",
    "description": "Shortens long URLs, redirects visitors quickly and counts their clicks asynchronously."
  },
  "actions": [
    { "lane": "download", "name": "Open link" },
    { "lane": "upload", "name": "Shorten" }
  ],
  "entries": [
    { "lane": "download", "action": "Open link", "element": "redirect" },
    { "lane": "download", "action": "Open link", "element": "stats-api" },
    { "lane": "upload", "action": "Shorten", "element": "shorten" }
  ],
  "connections": [
    {
      "id": "redirect-clicks",
      "source": "design",
      "from": { "kind": "service", "id": "redirect" },
      "to": { "kind": "resource", "id": "click-events" },
      "action": "Publishes clicks",
      "protocol": "Messaging",
      "interaction": "Asynchronous",
      "security": "Service identity",
      "channelUse": "publish"
    },
    {
      "id": "redirect-db",
      "source": "design",
      "from": { "kind": "service", "id": "redirect" },
      "to": { "kind": "resource", "id": "url-db" },
      "action": "Reads links on a cache miss",
      "protocol": "SQL",
      "interaction": "Request / response",
      "security": "Service identity",
      "access": "read"
    },
    {
      "id": "shorten-db",
      "source": "design",
      "from": { "kind": "service", "id": "shorten" },
      "to": { "kind": "resource", "id": "url-db" },
      "action": "Writes links",
      "protocol": "SQL",
      "interaction": "Request / response",
      "security": "Service identity",
      "access": "write"
    }
  ]
}
```

## Boundaries

- **Canvas notation.** Solid/dashed strokes and target arrowheads are presentation only; they do
  not add blueprint fields or change connection direction, interaction, action or inferred access.
  A read's caller → store arrow does not represent the return of bytes. Access still follows
  ownership, so an owner's individual read is not distinguished from a write.
- **Intent, not availability.** Settings and `thirdParty` names are design intent. The blueprint
  never claims that a template, runtime or verification exists.
- **Versioning.** A breaking change needs a new version. Version 2 renamed a connection's planned
  identity from `access` to `security` and gave `access` its read/write meaning. An optional field,
  a new list or a new enum value (for example a new kind) is additive within a version: the
  `actions` list and each entry's `action` were added within version 2. A generator must
  reject what it does not understand rather than guess.


Chat turn-only preview/review scope and assumptions are conversation metadata, distinct from persistent `scope` in v3. The review
reuses these findings and checks declared finite Create/Resolve signatures and positive-cache policy and reports remaining behavior contracts as **not specified**; it does not
change blueprint version 2 or certify application completeness, template support or runtime
behavior. A worker's outgoing call/publication/store dependency only expresses topology.

## Separate experimental export API

`POST /projects/:id/experimental-generation/preview` and `/download` are read-only-to-project
operations over the exact saved revision/source hash. `profileId: selected-source-v2` resolves
explicit selections/settings against the actual executing registry and assembles canonical saved
source, including `.jeeves/inputs/design.json`. Preview returns the full support report and exact
input/registry/archive identities. Known uninstalled declarations remain explicit custom gaps in
partial exports; YouTube product policy is not generated. Unknown refs, invalid bindings and
unsupported settings still refuse. Neither partial export nor implementation support establishes
runtime or strict TinyURL evidence. `profileId: youtube-local-v1` still requires the exact frozen profile and retains every
payload byte, diagram, report and historical origin. No name-based dispatch or substitution occurs.

Download requires the preview archive hash, reassembles, rechecks the saved source and returns a
bounded deterministic stored ZIP. See the [generator API](../jeeves-generator/README.md#jeeves-preview-and-zip-download)
for requests, limits and errors. This adds no fields or eligibility credit to strict blueprint/report
contracts. Native diagram/source diagnostics remain a separate export path.

The explicit YV2-16 preset command can materialize generation, graph/modules and ownership in
one operation batch. Blueprint reads still materialize nothing; v3 preserves those exact source
choices and v2 refuses their semantic loss. Local generator installation/runtime evidence remain
separate from this read-only representation and strict readiness.

## Normal authoring and preserved diagnostics

The canvas renders canonical process tiles and the inspector starts with name/kind/useful installed
settings. Logical-owner projection, role/deployable narration and declaration-only requirements/
operation/ownership forms are absent from normal authoring. This presentation does not change the
source or this API: v3 retains every ownership, operation, scope, legacy setting and generation
selection; v2 still refuses semantic loss. **Export diagram → Source & diagnostics** provides exact
source JSON, read-only declarations and unchanged strict readiness with precise target selection.
Experimental generation support and strict TinyURL/runtime evidence remain distinct.
