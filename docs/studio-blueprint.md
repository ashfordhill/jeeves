# Studio blueprint

The blueprint is the part of a design that a code generator reads. Code generation is a separate
future service and is not built here. The studio writes through operations; the blueprint is
derived on every request and is never stored or edited.

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
| `entries` | The tiles the user reaches directly: `{lane, element}`, `lane` being `download` or `upload`, sorted by lane then element. Empty for a design without lane entries. |
| `services` | Each studio application (service, browser, worker, billing, redirect, notification, identity, gateway): definition ref and status, settings, optional group, optional C1 context node, and its C3 `components` (kind, settings, purpose, typical third-party products, required link kinds). One service is one future deployable. |
| `resources` | Database, cache, queue, object store, search, CDN: definition, settings, optional owner. A store's owner is its only writer. |
| `externals` | External API elements (category, provider), plus C1 external systems that have no C2 element (`source: "context"`). |
| `groups` | Packages and their member services. |
| `connections` | Resolved C2 connections: typed `from`/`to` endpoints, action, protocol, interaction, security (the planned identity, such as `Service identity`), store access, channel use, timeout and retry. `access` is set on a link into a database, search index, cache or object storage: `write` when it comes from the store's owner (or a member of the owning package), `read` otherwise ([one writer per store](studio-settings.md#relationships)); it is derived from the owner, never stored. A queue link has `channelUse` (`publish` or `consume`) instead. C1 relationships with an external system that has no element appear with `source: "context"`. |
| `componentLinks` | A component's use of a sibling component or, through its `via` C2 connection, an element. |
| `omitted` | Anything that cannot be represented (`element`, `connection`, `component`, `component-link` or `entry`), with a reason (`no-studio-binding`, `endpoint-outside-blueprint`, `host-not-a-service`). Nothing disappears silently. |
| `findings` | Validation findings at this revision. Readiness gaps are `CONFIG_REQUIRED`. |

It leaves out layout, presentation, history and UI state. People are not included; they are not
generated.

## Example

The [TinyURL study](studio.md#the-tinyurl-study) at revision 1 has three entries, four services
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
  "entries": [
    { "lane": "download", "element": "redirect" },
    { "lane": "download", "element": "stats-api" },
    { "lane": "upload", "element": "shorten" }
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

- **Intent, not availability.** Settings and `thirdParty` names are design intent. The blueprint
  never claims that a template, runtime or verification exists.
- **Versioning.** A breaking change needs a new version. Version 2 renamed a connection's planned
  identity from `access` to `security` and gave `access` its read/write meaning. An optional field
  or a new enum value (for example a new kind) is additive within a version. A generator must
  reject what it does not understand rather than guess.
