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

## Contents (`blueprint: 1`)

| Field | Holds |
| --- | --- |
| `revision` | The design revision it was read from. |
| `system` | System name and description (C1). |
| `entries` | The tiles the user reaches directly: `{lane, element}`, `lane` being `download` or `upload`, sorted by lane then element. Empty for a design without lane entries. |
| `services` | Each studio application (service, browser, worker, billing, redirect, notification, identity, gateway): definition ref and status, settings, optional group, optional C1 context node, and its C3 `components` (kind, settings, purpose, typical third-party products, required link kinds). One service is one future deployable. |
| `resources` | Database, cache, queue, object store, search, CDN: definition, settings, optional owner. |
| `externals` | External API elements (category, provider), plus C1 external systems that have no C2 element (`source: "context"`). |
| `groups` | Packages and their member services. |
| `connections` | Resolved C2 connections: typed `from`/`to` endpoints, action, protocol, interaction, access, channel use, timeout and retry. C1 relationships with an external system that has no element appear with `source: "context"`. |
| `componentLinks` | A component's use of a sibling component or, through its `via` C2 connection, an element. |
| `omitted` | Anything that cannot be represented (`element`, `connection`, `component`, `component-link` or `entry`), with a reason (`no-studio-binding`, `endpoint-outside-blueprint`, `host-not-a-service`). Nothing disappears silently. |
| `findings` | Validation findings at this revision. Readiness gaps are `CONFIG_REQUIRED`. |

It leaves out layout, presentation, history and UI state. People are not included; they are not
generated.

## Boundaries

- **Intent, not availability.** Settings and `thirdParty` names are design intent. The blueprint
  never claims that a template, runtime or verification exists.
- **Versioning.** A breaking change needs `blueprint: 2`. An optional field or a new enum value
  (for example a new kind) is additive within version 1. A generator must reject what it does not
  understand rather than guess.
