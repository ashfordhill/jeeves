# Planned deployment environments (P53)

Use **Editor actions → Deployment plans** to declare placement for the existing logical
architecture. Each environment is an alternative hosted or optional private plan. It does
not duplicate applications in C2 or describe observed runtime state. The
[P53 specification](build-plan-c4-evolution.md#p53--logical-deployment-planning) and
[C4 guidance](c4-modeling.md) define the boundary.

## Shared model

Optional `architecture.deployments` contains environments with stable identities. Old designs
omit it without migration. The [Zod schema and validators](../packages/spec/src/architecture-deployments.ts)
are authoritative; the [example](../fixtures/designs/architecture-deployments.json) illustrates
one redirect service in several placements, two channels on a broker and an external provider.

| Declaration | Meaning |
| --- | --- |
| Environment | Hosted/private alternative, name and responsibility. Private delivery is optional. |
| Deployment node | Nested placement boundary with parent, technology, region/zone, operation ownership and responsibility. Counts and locations are declarations. |
| Infrastructure node | Broker, CDN/TLS/routing or another placement concern. Declared copies belong here. It can have a deployment parent. |
| Instance group | Existing C2 application/store identity, placement node and replica count. A managed store retains its logical identity. The diagram expands replicas; it creates no logical application copies. |
| Logical channel | An instance placement referencing a named queue/topic C2 identity on broker infrastructure, with count one. Distinct channels keep their own policies and relationships; broker copies do not create channel definitions. |
| External reference | Existing external C2 product or unbound C1 external system, outside deployment ownership. A C1 provider bound to C2 uses that C2 reference. |
| Logical interaction | Existing connection/context relationship plus deployment endpoints. Exact logical endpoints and direction must match; current labels/protocols are projected from their source. |
| Infrastructure wiring | Distinct deployment-only identity, explicit purpose/protocol and at least one infrastructure endpoint. It defines no application contract or executable connection. |

IDs cannot collide with other deployment or architecture/design identities. Parents must belong
to the same environment, be deployment nodes and form an acyclic tree. Missing references,
incorrect external/instance classification, contradictory endpoints and invalid counts reject
the whole operation. Each environment supports 100 nodes, 100 instance groups, 50 external
references, 200 interactions, 200 expanded container instances and 2,000 projected interactions;
there are at most 12 environments and 1–32 replicas per declaration. Empty environments and
undecided technology/location/responsibility remain editable intent.

## Reviewed legacy mappings

Add infrastructure and choose **Reviewed legacy C2 mapping**. Only an existing internal
deployment-infrastructure classification is eligible. Review its responsibility and relationship
direction, supply a reason, then save the mapping. The source element remains visible in C2
with its original identity and relationships; no reclassification, replacement or automatic
migration occurs. Each source maps once per environment. An externally operated application
or store is still a logical application/store; an external product remains outside the boundary.

## Editing and layout

Use **Plan object** to inspect/edit each declaration; all fields and insertion/removal actions
are mouse accessible. Missing references after removal stay visible until repaired. Save applies
one `setArchitecture` operation through the existing API, preserving the rest of the model.
Semantic undo/redo and reload use existing design history. Cancel discards changes; closing a
dialog retains an unsaved draft during the current editor session. Stale saves retain the draft
and require a fresh review. Chat uses the same operation schema and validators; deployment
snapshots cannot be automatically replayed over a concurrent revision.

The diagram shows nested boundaries, instance replicas and external products. **Inspect
deployment object** reaches each instance/interaction even when it is outside the camera.
The selected summary and **Diagram options → Focus selected object / Fit selected** provide
detail. Drag/nudge, direction, Fit, Reset and layout undo/redo use P49's shared controls.
Positions/camera live in `layout.architecture["deployment:<environment ID>"]`, separately from
semantic revision and other views. Removing an environment or replica prunes obsolete layout.

## Local view and evidence

**Local deployment** remains P33's derived, read-only view for supported `http-service`
versions 0.1.0–0.4.0 and their declared execution/pool contracts. It does not inspect arbitrary
Compose services, running containers or live health. Planned environments do not replace it
or claim its released runtime behavior. See [P33 evidence](evidence/p33/README.md).

Planning creates no deployment files, credentials, resources, runtime measurements, generation
scope or new executable templates. Regions/replicas do not establish failover, capacity or
availability. Existing generated artifacts and ownership remain unchanged apart from the
lossless design snapshot. [P53 evidence](evidence/p53/README.md) records actual verification.
