# Studio blueprint

The blueprint is the part of a design that a code generator reads. The
[experimental generator foundation](../jeeves-generator/README.md) validates saved explicit v2 generation source and assembles in-memory bundles from installed
implementations. It also retains the exact frozen local-v1 profile and its 19 experimental
template families. The canvas previews/downloads the selected source; unsupported designs refuse
without substituting a frozen baseline. The active
[field-project plan](plans/reliable-foundations/youtube-field-project-plan.md) keeps the package
separate from the studio; its partial report grants no strict readiness or runtime credit. The studio writes
through operations; the blueprint is derived on every request and is never stored or edited.

The `studio-tinyurl-foundation@1.0.0` study, which New project no longer offers, stores complete
schema-v3 declarations. Its default v2 export deliberately refuses exact scope/ownership/operation
loss; request `?version=3` for the full study and report. The extended `studio-tinyurl@3.3.0` stays schema2
with its prior v2 meaning. Creating either study is a single complete seed/history edit.

Canvas selection, its line highlight and Fit are view state. They neither filter this endpoint
nor change the design revision: the blueprint always includes every saved relationship.

```text
studio (operations) ──▶ design document ──▶ designBlueprint() ──▶ GET /projects/:id/blueprint ──▶ jeeves-generator (selected-source v2 or exact frozen-v1 preview/ZIP)
```

## Installed feature authoring

Normal mouse and chat actions use `buildSupportedAuthoringCommand` with the executing registry
reported by `GET /generation-support`. Module commands select templates: modules, generation and
ownership save in one batch, and a schema-2 design is upgraded in that batch. There is no normal
preset attachment; `buildGenerationPresetCommand` remains a source fixture for the reuse example
and tests. Useful supported settings reuse existing source fields; TTL and concurrency mirrors update atomically. No parsing/reload migration occurs.
Display renames preserve element, component, selection, owner and link IDs, generated target
addresses and durable/extension namespaces ([names and IDs](studio.md#inspector)). Explicit identity
changes require application migration. Normalized Custom call slots carry the exact installed
Favorites, Rate limiter and Cache reader input/output/version/effect requirements and stable callee module ID; mismatches refuse
with the required/installed difference. Cross-process installed-template adapters remain gaps;
route stubs have API8 workload-authenticated GET/POST operation roots. Writable database stubs also
emit a private POST/root-only `/internal/work/<module>` protocol route, reported as requiring an
explicit workload-operation opt-in. Its presence does not make an unfinished product stub runnable.
Durable-work declarations are application extension code, with no extra blueprint settings;
see the [generator contract](../jeeves-generator/README.md#durable-work-contract-additive-extension-api-v8).

An explicit component-link `slot: "workload"` distinguishes a module's Identity
selector from their legacy generic Identity dependency. Blueprint v3 retains that finite tag;
older untagged links keep their inferred use. The normalized process records the issuer, stable
workload client/audience, source-module service calls, allowed operations and maximum callers.
Preview refuses missing/mismatched issuer setup before export, including Private network links.
User bearer forwarding is private and limited to compiled recipients sharing the user issuer.

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
| `ownership`, `ownershipStatus`, `ownershipFindings` | Complete explicit owners, canonical element roles, source/projection authority, role grants (including exact product table operations and named published views), explicit worker `sharedWith` API membership and dependency requests, plus targeted unresolved/refused declarations. Rows sort deterministically; status is declared or unspecified, never verified. |
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

Optional `generation` is preserved exactly in v3, including unknown well-formed refs and the
Runnable processes option, `generation.processes: true` (absent means off; `false` is invalid).
V2 refuses `generation.version`, `.runtime`, optional `.preset`, optional `.processes` and every
`.selections[index]`; even an
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
reuses these findings, with readiness findings only counted, and reports the turn's own obligations as **not specified**; it does not
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

The YV2-16 preset command, now a source fixture only, materializes generation, graph/modules and
ownership in one operation batch. Blueprint reads still materialize nothing; v3 preserves those exact source
choices and v2 refuses their semantic loss. Local generator installation/runtime evidence remain
separate from this read-only representation and strict readiness.

## Normal authoring and preserved diagnostics

The canvas renders canonical process tiles and the inspector starts with name/kind/useful installed
settings. Logical-owner projection, role/deployable narration and declaration-only requirements/
declaration-only operation forms are absent from normal authoring. Worker ownership choice and exact database product access are normal implemented controls. This presentation does not change the
source or this API: v3 retains every ownership, operation, scope, legacy setting and generation
selection; v2 still refuses semantic loss. **Export diagram → Source & diagnostics** provides exact
source JSON and read-only ownership/access, whose owner buttons select a logical owner for chat.
Experimental generation support and strict TinyURL/runtime evidence remain distinct.


The installed export extension contract is v6. Its HTTP surface includes shared pure body formatting, generated status/
headers, bounded/raw route declarations, distinct liveness/readiness and safe request logs. This
changes generated adapters, not diagram schema or blueprint eligibility. See the
[generated HTTP contract](../jeeves-generator/README.md#generated-http-contract-extension-api-v4).


RG06 database permissions use the existing `ownership` records. `roles[].sharedWith` explicitly
names the API role sharing its logical owner with a worker. `resources[].productNamespace: "owner"`
persists the owner-scoped product-state decision. Clearing grants keeps that namespace; a named-view
audience alone leaves legacy namespaces unchanged. `grants[].product.tables[]` names
private product tables and exact operations; `product.views[]` names the reader's permitted
`published` views. Generation's normalized product state records the unambiguous logical owner,
shared `p_<owner ID>` schema and role audiences. Different process IDs retain different logins.
Display renames change none of those identities. Template implementation grants are separate;
product declarations cannot name them. There is no blanket published-view grant or runtime DDL
credential. Extension API v7 adds application-owned versioned product declarations, checksummed
namespace migrations and registered parameterized SQL on stub database links. Product-only runtime
credentials remain separate from template credentials; queries run READ ONLY. Migration SQL uses
a namespace-only role while setup owns the protected ledger and published-view grants. These
scaffolds do not add diagram settings or a schema designer. Legacy SQL updates require an explicit
external baseline and staged API migration; namespace changes still require a fresh export and
explicit application/data migration. See the [product SQL contract](../jeeves-generator/README.md#product-sql-contract-extension-api-v7).

The normalized export/Preview RG12 model records Rate limiter as an `in-process` callable with the read effect class (private admission
coordination, no product write authority), its own host's Required verified-identity dependency,
cache write access, stable module/process/owner IDs and API v8. Its `limiter.limit` and
`limiter.windowSeconds` inputs are the two useful settings; fixed sliding-window/shared-cache/key
policy support is checked too. Custom/Data access **admission** slots carry the exact
`rate-limiter.admit@1` contract, `rate-limiter.empty` input and `rate-limiter.decision` output. Blueprint v3 retains the finite limit/window settings and component links; Preview/export adds the
installed capability contracts and unfinished hook gaps separately. Neither claims the product
caller has supplied or invoked the key policy.

RG13 Preview/export records Cache reader's `cache-reader.read@1` read contract, public eligible-record
caller policy, stable process/module/owner IDs, read-only source and private cache coordination
access, and HTTP/in-process transport. Blueprint v3 retains `freshness`/`transport` settings and
`read` component links. Registered source SELECTs narrow the existing product declaration/grant
maximum. In-process output includes version and absolute validity; the optional HTTP adapter keeps
the prior record body and exposes those facts in `X-Jeeves-Cache-Freshness`, `X-Jeeves-Cache-Version`
and `X-Jeeves-Valid-Until` headers with `Cache-Control: no-store`.
The normalized setting rows are `reader.freshness` and `reader.transport`; legacy absence keeps
`immutable-positive` and `http`. Generated entry namespaces bind stable process/module/source IDs,
`cache-reader.read@1`, freshness and TTL. Copies must use the same product key/codec/eligibility and
source-version policies; changing these needs an explicit product policy/key migration. Changing
scope IDs, freshness or TTL uses a different namespace. Hits never renew validity. Compare-version
fencing lasts only while the key is retained: eviction, expiry or data loss removes the fence;
there is no durable watermark or immediate invalidation. Absolute delivery checks assume compatible
UTC clocks. Optional cache failure uses bounded authoritative fallback and recovery, not stale data.


HTTP Cache reader exposure on an internal service refuses because no workload-authenticated
template adapter is installed. Select `in-process` and invoke it through an authenticated route
module. Public eligible-record HTTP exposure remains supported.

RG16 Blueprint v3 retains each `scheduled-task` module's bounded `intervalSeconds`, state link,
logical owner and exact product grants. The installed normalized binding is `scheduled-task` with
its writable `state` dependency and `task.intervalSeconds` setting consumer. Runnable process
rows classify it as `scheduled-task`, independently of routes or deliveries. Preview/export
reports each process's `schedules` (module, interval, `coalesce-current-one-outstanding` policy)
and the handler scaffold separately from runtime evidence. No synthetic queue is required.

### Webhook receiver binding (RG17)

`webhook-receiver` is a Service module and installed binding with a declared writable `state` database dependency, explicit API logical owner and Runnable processes. Blueprint module settings preserve `bodyLimitBytes` and `replayWindowSeconds`; normalized consumer inputs are `webhook.bodyLimitBytes` and `webhook.replayWindowSeconds`. Selection identity may differ from stable module identity. The latter binds signing/route/work namespaces; generated settings lookup uses selection identity. Pure mapper callbacks and product SQL remain owned extension inputs, never normalized JSON functions/type expressions. [Envelope and lifecycle](plans/reliable-generation/evidence/rg17/README.md).

### Receipt-backed consumers (RG18)

Event counter settings include `deliveryHorizonSeconds`; the normalized selection consumes it as
`receipt.deliveryHorizonSeconds`, and its process config passes the value with fixed seven-day
retention to the counter. Event consumer has an optional writable owned `state` connection. A
standalone consumer remains an application stub; exporting `receiptConsumer = defineReceiptConsumer`
opts its existing delivery loop into generated receipt/scoped-product processing. Blueprint state
connections and precise product declarations remain authoritative. This adds no public admin route.

The `browser-session` binding names the lead's selected Identity and writable owned state. Version3 retains the normal signIn/idleSeconds/absoluteSeconds/guestContext/offlineAccess settings and stable host/module/owner identities; normalization traces these into the compiled policy, precise protected054/append-only055 state/grants and process routes. Refresh attempt/generation records are private runtime state and never diagram controls. Private issuer endpoints, client secret, ring material, session IDs and tokens never enter blueprint or source. Export reports the selected Identity's HTTPS/client-registration integration gap. Unsupported bearer-guard/JWT-only-template combinations and session forwarding refuse.
