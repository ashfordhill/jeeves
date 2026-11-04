# Studio model contract

Part of the [build specification](../../build-plan-studio-ux.md). These are implementation
requirements, not descriptions of capabilities already shipped. Read the
[configuration matrix](configuration-matrix.md) alongside this file.

## 1. Keep one graph

Retain `DesignDocument.elements`, `connections` and the existing `architecture` declarations.
An actual application, logical store or external integration remains an **element**. A real
relationship remains a **connection**. Existing C1 nodes/relationships and C3 component identities
remain preserved. Do not create a separate editable graph in React state, a second document store,
or a freeform canvas whose content later has to be guessed back into architecture.

Add optional `architecture.studio`, with its own `version: 1`. Its purpose is typed studio settings,
service grouping and presentation ownership over those same element/connection IDs. Keep design
schema versions 1/2 readable; absence of `studio` retains the old semantic interpretation. Unknown
studio versions must produce an explicit unsupported-version result, never silently strip data.
An ordinary layout save must not add the property or upgrade the design.

The proposed source split is `packages/spec/src/studio-model.ts`, `studio-definitions.ts`,
`studio-operations.ts`, `studio-view.ts` and `studio-validation.ts`. Export public contracts through
the existing spec index. These file names are new deliverables; existing integration seams are
`design.ts`, `architecture.ts`, `operations.ts`, `apply.ts`, `validate.ts`, `architecture-view.ts`,
`architecture-patterns.ts`, `architecture-library.ts`, `architecture-handoff.ts` and `layout.ts`.

## 2. Exact semantic shape

Implement strict Zod schemas and inferred TypeScript types. The following is the structural
contract; field unions and limits are in the configuration matrix. Do not store opaque JSON in
`settings` as a shortcut.

```ts
type DefinitionRef = { id: string; version: string };
type StudioOwner = { kind: "element" | "package"; id: string };
type StudioModel = {
  version: 1;
  origin?: { example: DefinitionRef; goalManifestSha256: string };
  elements: {
    element: string;
    definition: DefinitionRef;
    settings: StudioSettings; // closed discriminated union, matrix §2–§4
    owner?: StudioOwner;      // logical resource ownership, not physical hosting
  }[];
  packages: {
    id: string;
    name: string;
    description: string;
    members: string[];        // actual application element IDs only
    preset?: DefinitionRef;  // optional provenance, not a runtime-template ref
  }[];
  connections: {
    connection: string;
    settings: StudioConnectionSettings;
  }[];
};
```

Limits: at most 500 element bindings, 50 packages, 50 members per package and 500 connection
bindings, additionally bounded by their actual document targets. Package names use the existing
trimmed 1–120-character rule; descriptions use 0–240. IDs use the existing `idSchema`; definition
versions use the existing exact-version schema. Package IDs join global ID enumeration and may
not collide with any design identity. Duplicate bindings or duplicate memberships reject the batch.

`StudioSettings.kind` is one of `service`, `browser`, `worker`, `billing`, `redirect`, `notification`,
`identity`, `database`, `cache`, `queue`, `object-store`, `search`, `cdn`, `external-api`.
Definition IDs are `studio-<kind>` at version `1.0.0`. Reusable service-package presets have their
own immutable definition IDs and expand into these same objects; they are not new settings kinds.
The first release adds no generic C3 module editor. Existing authored components are retained as
source material; ordinary libraries, routes and business rules do not become new configurable nodes.

`origin` is optional read-only provenance for a reconstructed example, not a runtime binding.
Its hash is 64 lowercase hexadecimal characters. Resolve its exact manifest from a local immutable
example-source registry; never fetch a path supplied by a design. Copying a design preserves origin;
inserting a composition preserves its applicable decision/source descriptions without replacing the
destination project's origin or claiming one seed manifest covers the combined project. A manifest
describes the seed, not a claim that later edits still satisfy every source requirement. Preserve
unresolved C4b decisions when linked objects are removed; mark the review stale rather than updating
the source or claiming the obligation has been met.

### Single destination for each value

- Name/description: canonical element fields, not another copy in `studio`.
- Application/store/external classification: `element.classification`, set explicitly on creation.
  Provider selection does not change an application into an external system.
- Studio technical choices: the bound `settings` union. They are design intent with no implied
  runtime implementation. Do not mirror them into old `planned.config`, attachments or backend data.
- Relationship action/protocol/interaction: existing canonical fields. For existing planned
  connections, update `planned.label/protocol/interaction` through a dedicated supported operation;
  do not add a conflicting top-level value. The resolver chooses this one source explicitly.
- Timeout/retry/channel-use settings: the single studio connection binding. Existing exact
  contracts/bindings remain unchanged; coarse options cannot override or weaken their guarantees.
- Executable template/version: existing `element.template`/attachment/recipe references only.
  A `DefinitionRef` is a studio definition and must never pass as one of these template refs.
- Coordinates/camera: layout only. No position, border style, collapsed state or readiness badge
  is stored in the semantic settings.

New studio elements have `template: null`, `config: {}`, `attachments: []`, no legacy `planned`
capability, an explicit classification, and one studio binding. Do not seed the entire historical
capability's defaults invisibly. Update validation to recognize this finite design intent while
retaining an unsupported-generation finding. Existing elements are never converted on read.

Enforce that clean binding rule in semantic validation: do not attach a studio settings record over
an existing template/planned/configured element and thereby create two editable configuration
sources. Such a conversion is unsupported in this scope. Mixed documents can contain unchanged
legacy objects alongside newly created studio elements; the generation guard covers the combined
document. An eventual reviewed migration is a separate task, not a hidden editor side effect.

## 3. Service, package and detail rules

A single service represents one application deployment boundary. `execution: docker` is the
default. Managed execution and externally hosted/browser clients remain explicit alternatives;
they do not claim Docker packaging. A worker with independent execution is another application
element. A common REST client library is neither a service nor a child card.

A package groups two or more application elements for presentation and reuse. An empty/single
member package is a creation draft, not persisted state. Each element can belong to at most one
package. Packages cannot contain packages; this avoids arbitrary nested diagram trees. Resources
can name a package as logical owner but are not deployment members. A package has no language,
Docker image, HTTP port or implementation template of its own. Those belong to its members.

At C2 show one package card in place of its members. At C3 show the member services and relevant
resources. Double-clicking a member with useful dependencies opens that service's C3 scope; the
breadcrumb records the package, but the level remains C3. No implied C4/code editor follows.

Scalar settings, including a Billing provider, live in the selected card's inspector. A service
opens its own C3 only if it has meaningful connected dependencies. The package itself opens its
member view; merely belonging to a package does not make a child service independently expandable.
Do not create an empty view, placeholder API/adapter boxes, or child boxes whose only editable
content is a name. In a service detail view, the owner service is a small ordinary selectable
anchor so relationships have a visible endpoint. It references the same element, not a clone.

The owner requested compact Billing and Redirect. The initial Billing definition is one service
card with provider/binding settings. A larger Billing/Redirect package is possible only when a
preset or explicit membership contains actual independent services. Never split these automatically
to justify the package UI.

## 4. Resource ownership and shared queues

Every logical store/cache/queue has one element ID. Its optional owner means responsibility for
that logical resource, not a deployment process or a prohibition on all shared physical hosting.
The owner must be an application element or a valid package; resource/external ownership cycles
are impossible. Application/externally provided API bindings may not use this owner field.

Database/cache/object-store/search resources created at C2 remain visible there, including when
an owner is selected. C3 shows references to the same resources when the selected service uses
them. A package may hide a resource at C2 only when the resource's owner is that package and all
its connections stay within its members. Cross-package use makes that resource visible at C2.
No user-facing “visibility rules” form is required.

**Queues/topics always appear as boxes only at C3.** New queues must have an owner, chosen from
the active service/package scope. An existing shared queue is chosen by identity from “Use
existing” in the C3 resource picker; creating a second consumer does not create a second queue.
Changing provider on that queue changes its one setting for every referencing view. A queue's
broker/provider is a choice on the resource, not an automatically generated “queue microservice.”

Use explicit directed channel connections for new designs:

- Service → queue, `channelUse: publish`.
- Queue → service, `channelUse: consume`.

These are message-flow conventions. The consumer's actual pull protocol is an implementation
detail; do not infer it from the arrow. Set interaction asynchronous. Require the endpoints to
match the selected channel use; do not infer publication or consumption from names/labels.
Legacy queue links lacking unambiguous roles remain preserved and visible in C3; classify their
C2 summary as unresolved in Generate rather than invent a producer/consumer pairing.

At C2, for each known producer/consumer pair of the same queue, derive an asynchronous summary
from producer to consumer (or their packages). Retain both underlying connection IDs and the queue
ID as provenance. Internal pairs inside one collapsed package do not draw self-arrows. A queue with
only a producer or only a consumer remains editable in its owner's C3; show its incomplete design
in Generate rather than fabricate the other endpoint. A single-service self-use needs no C2 loop.

Queue/provider configuration here does not promise exactly-once delivery, transactional outbox,
deduplication or broker provisioning. Such guarantees require later template contracts and evidence.

## 5. Projection and connection identity

Add a pure `studioViews(design, definitions, projectName)` projection. It may reuse existing
projection helpers but must not mutate input or call APIs. Return C1, C2 and requested C3 scopes,
semantic references for every node, and complete provenance for every displayed relationship.
Suggested view keys: `studio:context`, `studio:containers`, `studio:service:<id>`,
`studio:package:<id>`. IDs are deterministic from canonical IDs, never array indexes or labels.

For an edge include `sourceRefs`, `targetRefs`, `connectionIds`, optional `queueIds` and existing
contract/binding refs where available. A displayed aggregate carries **all** its members. A reverse
arrow is a different direction; different labels alone do not create or merge semantic identities.

Group repeated dependencies into one visible relationship per source/target application or package.
Represent mixed underlying protocols as a bundle with separately inspectable members, not one
editable protocol value. Opposite directions remain distinguishable. At C3, expand only the
connections relevant to that scope; cross-scope resources/dependencies are reference nodes with
their real identity. Do not inline an entire remote service's internal graph.

Geometry may share a trunk for compatible edges from one source with a common interaction/protocol.
A shared trunk is presentation data, never another saved connection. It has no unique timeout or
retry value. Clicking a multi-member aggregate opens its compact member chooser; choosing a
member edits the real relationship. Never fan out one edit to all members implicitly.

C1 remains context: person/system/external-system symbols, names and short actions. An external
provider selection does not automatically manufacture C1/C2 boxes or duplicate an integration.
Use the existing C1-to-element link only when it denotes that actual external element.

## 6. Mutations, references and validation

Add an operation `setStudio` accepting the complete strict studio value (or `null` for explicit
removal). It changes only `architecture.studio`, retaining every other architecture property.
Require an existing architecture/system; creation batches add the system first if absent.
Client helpers produce operations from the latest accepted document; never submit a stale cached
copy of the entire architecture for a small inspector edit.

Add `updatePlannedConnection` for its exact label/protocol/interaction/security fields. Existing
`updateConnection` remains for ordinary connections. Build one shared command layer for add,
edit, connect, group, ungroup and delete; toolbar and chat call it. One action is one atomic batch.
Persisting a new element/connection and its studio binding must succeed together or not at all.

Validate at the semantic boundary, not only in form components:

1. Targets exist and agree with definition kind, classification, settings kind and provider/engine
   compatibility; definition/version is known or clearly unresolved, never silently substituted.
2. Resource owners and package members are valid; package membership does not change execution.
3. All selected resource/dependency references target the required kind; service references cannot
   point to packages as though packages were real API endpoints.
4. Queue roles and direction match. Timeout/retry are permitted only on eligible relationships.
5. Deleting an element removes its studio binding and connection settings only as part of the
   existing explicit delete action. If it owns shared resources, require reassignment or explicit
   removal in that same reviewed action; never cascade-delete another service's resource.
6. Removing the last necessary member dissolves a package into remaining members; references to
   package ownership are reassigned explicitly or rejected. An ungroup action preserves all children,
   resources and connections. Package delete exposes “Ungroup” and “Delete members” as distinct
   explicit actions; default to Ungroup. The latter uses existing destructive-action confirmation.
7. Copy/template insertion remaps every ID: members, resource owners, frontend serving refs,
   connection settings and all existing architecture refs. External bindings require explicit reuse
   mappings, never a name match. Unknown external mapping prevents insertion.
8. Preview, apply, history, undo/redo, reload, import/export and handoff preserve these fields.
   Exported definition refs/configuration remain deterministic and non-secret.

Portable handoff adds optional typed `studioSources` entries containing the exact goal manifest
and hash identified by origin (at most one in this version). The manifest schema and row fields are in the
example coverage contract. Resolve locally and verify the hash; a missing version/hash mismatch
is an explicit unresolved-source result, not a network fetch or fabricated manifest. Ordinary
project export retains the origin and decision refs even without a resolved source bundle.

Readiness is separate from structural validity: an unknown implementation can be a valid saved
design. A dangling owner/reference or invalid configuration cannot. Do not weaken frozen backend
validation or remove declarations to make a design pass.

## 7. Existing documents and availability

Without `architecture.studio`, use a read-only semantic adapter for the new presentation. Preserve
all existing fields, IDs, template bindings, backend contracts, annotations and layouts. Expose
safe canonical name/description edits and only existing fields with a lossless reviewed mapping;
do not add studio defaults just because a field looks absent. Unsupported legacy configuration
remains inspectable through export/Generate's source summary, without its old authoring forms.

The initial legacy edit allowlist is name/description and context-relationship action text only.
Do not expose the new language/provider/protocol/policy controls on an unconverted legacy object.
An additional legacy field needs an explicit mapping to its actual validated source and a checked
runtime implication before exposure. There is no automatic conversion action in this scope; use a
fresh studio example/project to adopt the new settings vocabulary.

The adapter uses an explicit mapping table of existing capability IDs, not label heuristics.
For unknown families, display the real name and a generic symbol; do not invent a kind/provider.
Legacy components without a substantive setting in the new allowlist are summarized under their
owner and in Generate, not shown as fake configurable children. This is presentation filtering;
the document and all its obligations remain unchanged. Fresh examples are the route to fully
using the new vocabulary. Never silently “modernize” a saved project on open.

The current generator does not understand the new studio contract. Until a separately approved
runtime task implements an exact resolver, a design with studio bindings remains **design-only**
for application generation. Enforce this server-side as well as in Generate. A language/provider
choice, template-shaped name, or old template attached elsewhere must not bypass this guard.
Existing designs without studio bindings retain their current supported generation behavior.
Portable design export remains allowed. This preserves the distinction between future C4a candidates
and working templates without limiting the canvas to today's implementations.

Implement compatibility and generation guards before exposing new editing. UI simplification must
never allow the old compiler to silently ignore new settings and call its output complete.
