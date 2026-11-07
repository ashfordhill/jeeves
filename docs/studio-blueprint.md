# Studio blueprint

The blueprint is the part of a design that a code generator reads. Code generation is a separate
future service and is not built here. The studio writes through operations; the blueprint is
derived on every request and is never stored or edited.

Canvas relationship focus, hidden/dimmed counts, route selection and Fit focus are view state.
They neither filter this endpoint nor change the design revision: the blueprint always includes
every saved relationship.

```text
studio (operations) ──▶ design document ──▶ designBlueprint() ──▶ GET /projects/:id/blueprint ──▶ generator (future, separate)
```

## Endpoint

`GET /projects/:id/blueprint` returns the blueprint JSON with `Cache-Control: no-store`: 404 for an
unknown project, 400 for a malformed ID. It is a pure read and changes no revision, layout or
history. Behind the web proxy the same route is `/api/projects/:id/blueprint`.

## Source

- Schema: `designBlueprintSchema` in
  [`packages/spec/src/studio-blueprint.ts`](../packages/spec/src/studio-blueprint.ts).
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


Chat preview/review scope and assumptions are turn metadata, not blueprint fields. The review
reuses these findings and reports declared behavior contracts as **not specified**; it does not
change blueprint version 2 or certify application completeness, template support or runtime
behavior. A worker's outgoing call/publication/store dependency only expresses topology.
