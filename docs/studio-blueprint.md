# Studio blueprint: the code-generation boundary

Added by SG03 of the [studio grid plan](build-plan-studio-grid.md) §6 (owner decision O7).

The blueprint is the only part of a design a future code generator reads. Code generation is a
separate backend service and is not built here. The studio keeps writing through the existing
operations; the blueprint is derived on every request and never stored or edited.

```text
studio (operations) ──▶ design document ──▶ designBlueprint() ──▶ GET /projects/:id/blueprint ──▶ generator (future, separate)
```

## Endpoint

`GET /projects/:id/blueprint` returns the blueprint JSON (`Cache-Control: no-store`). 404 for an
unknown project, 400 for a malformed ID. It is a pure read: no revision, layout or history change.

## Source

- Schema: `designBlueprintSchema` in [`packages/spec/src/studio-blueprint.ts`](../packages/spec/src/studio-blueprint.ts).
- JSON Schema (draft 2020-12): `designBlueprintJsonSchema()`. A snapshot is in
  [SG03 evidence](evidence/studio-grid/SG03/blueprint.schema.json).
- Projection: `designBlueprint(design, projectName)`. Pure and deterministic; every list is sorted by
  identity.

## Contents (`blueprint: 1`)

| Field | Holds |
| --- | --- |
| `revision` | The semantic design revision it was read from. |
| `system` | System name and description (C1 scope). |
| `services` | Each studio application (service, browser, worker, billing, redirect, notification, identity, gateway): definition ref and status, settings, optional group, optional C1 context node, and its C3 `components` (kind, settings, purpose, typical third-party products, required link kinds). One service = one future generated deployable. |
| `resources` | Database, cache, queue, object store, search, CDN: definition, settings, optional owner. |
| `externals` | Studio External API elements (category, provider), plus C1 external systems that have no C2 element (`source: "context"`). |
| `groups` | Group frames (studio packages) and their member services. |
| `connections` | Resolved C2 connections: typed `from`/`to` endpoints, action, protocol, interaction, access, channel use, timeout and retry. C1 relationships with an external system that has no element appear with `source: "context"`. |
| `componentLinks` | A component's use of a sibling component or, through the `via` C2 connection, an element. |
| `omitted` | Elements without a studio binding, and connections/components/links that would point outside the blueprint, each with a reason. Nothing disappears silently. |
| `findings` | Studio findings at this revision. Readiness gaps are `CONFIG_REQUIRED`. |

It omits layout and positions, presentation (visuals, annotations, labels beyond the action), history
and studio UI state. People are not included; they are not generated.

## Boundaries

- **Intent, not availability.** Settings and `thirdParty` names are design intent. The blueprint
  never claims that a template, runtime or verification exists; generation still rejects studio
  designs. Keep intent, template availability and evidence separate
  ([C4 modeling guidance](c4-modeling.md)).
- **Studio model only.** Only studio-bound elements are generated parts. Legacy elements (old
  templates or planned capabilities without a studio binding) appear in `omitted` with
  `no-studio-binding`; most pre-studio projects therefore have a near-empty blueprint.
- **Versioning.** A breaking change needs `blueprint: 2`. Adding an optional field or a new enum
  value (for example a new kind) is additive within version 1; a generator must reject what it
  does not understand rather than guess.
