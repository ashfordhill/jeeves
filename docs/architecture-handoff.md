# Architecture implementation handoff

P57 adds **Editor actions → Implementation handoff** for the saved revision. It captures
an immutable review snapshot and the selected C1, C2, C3 or focused diagram. **Deployment plans
→ Export deployment handoff** captures that saved deployment view; save or cancel its draft
first. Downloads remain available for blocked/incomplete designs so missing work stays visible.

The three files form a portable bundle; keep their names and save them together:

- `architecture-handoff.md`: scope, actors, responsibilities, authored relationships,
  exact contracts/interfaces, policy/data authority, scenarios, decisions, coverage,
  implementation obligations, deployment intent and reusable provenance.
- `architecture-handoff.json`: strict `jeeves.architecture-handoff` schema version 1,
  exact typed contract definitions, sanitized source definitions and architecture-template manifests, identity-linked
  completeness/open items, recorded evidence, selected projection geometry and fingerprints.
- `architecture-diagram.svg`: standalone vector output of the selected view's actual node,
  relationship and label geometry, with a title, legend, planned status and selected scenario
  step numbers. C1 declared-context dashes and C2/C3 interaction styles remain distinct.
  Large whole-system/C3 views remain overviews; SVG supports zoom and focused views stay available.

The actual Zod schemas and deterministic builder live in
[`architecture-handoff.ts`](../packages/spec/src/architecture-handoff.ts); the read-only API is
`GET /projects/:id/architecture-handoff?baseRevision=N`. It refuses revision conflicts and
returns `Cache-Control: no-store`. It reads saved definitions, validated recipe provision and
recorded evidence; it does not inspect application files, fetch remote definitions, generate,
write locks, create agent tasks or choose models. Unknown/pinned-but-unavailable local versions
are labeled unavailable rather than replaced by a newer version.

[P62 logical contract export](contract-types.md#portable-logical-json-schema) adds optional
`contracts[].jsonSchema`: a self-contained draft 2020-12 schema catalog with exact local `$defs`
and transport declarations. Incomplete planned contracts carry `schemaIssues` instead. Their
intact typed `definition` remains available in both cases. API catalogs contain several message
schemas; select an operation/body reference before validating an instance. Binary bodies remain
bounded byte descriptors, and source-backed contracts retain their existing source definitions.
Typed field names, literals and route paths are preserved exactly. None of these exports supplies
a runtime, verifies a serializer or changes template availability.

## Scope, ownership and approval

Use **Scope and approval** to name the implementation review scope. Open capacity/commercial
choices need an owner and the scope they block. To defer those choices, select partial scope,
state the exclusions and save the scope. Then record explicit approval. These are ordinary
semantic Save/Cancel and history operations; closing a draft cancels its edits. Review approval
means architecture agreement for that scope, never deployment or production certification.

Ready status requires structurally sound references, complete critical contract/behavior
boundaries, linked acceptance expectations and assigned open choices outside an explicit
partial scope. Required-but-unbound interfaces, unresolved/stale contract shapes, policy
conflicts, unassigned decisions and missing obligation boundaries/expectations block it.
P51's accepted exploration tradeoffs cannot waive required behavior or contract gaps. Scenario completeness
and authored expectation-review states are included separately; neither records a passing test.
Objectives always remain unverified targets, even when their values are fully authored.

Approval stores the canonical design fingerprint. A rename, contract/policy/scenario change,
project identity/name or review-scope change makes it stale. Revision counters and the approval prose
itself are excluded from that fingerprint. Layout, focus, direction, pan and zoom are stored
separately; they do not invalidate architecture decisions. Diagram geometry has its own hash,
including view membership/style and any selected scenario. Camera transforms are excluded.
A dialog retains its captured revision; changes elsewhere require reopening before approval.

## Availability and evidence

Coverage distinguishes exact available executable template versions, validated recipe-supplied
behavior, planned architecture responsibilities, custom implementation obligations and external
responsibilities. A local architecture-template publication supplies architecture only. Missing
implementation work points to its exact contract/binding identities and scenario outcome or
pinned pattern-invariant expectations; gaps are explicit. These obligations are descriptive
handoff data, not implementation tasks or generated tests.

Recorded infrastructure/template/application checks retain project, revision, check IDs,
status, omitted-record counts and a hashed local-output identity. Each historical generation/run
retains its own environment identity. Output paths and opaque runtime configuration are omitted;
source-backed definitions omit example/default values. Known planned architecture fields are
preserved. The original manifest content pin is distinct from its sanitized portable copy.
Target provenance includes the source identity/revision without copying its private baseline
or borrowing its verification history. New planning designs and clones inherit no passes.

See [P57 evidence and portable fixture bundles](evidence/p57/README.md), the
[QRWTY study](examples/qrwty-target.md) and [Inventory study](examples/inventory-architecture.md).
P46–P57 completes architecture authoring and handoff. Runtime/templates, generation and live
adoption require a separately scoped next-phase plan; review approval does not enable partial
or dependency-dropping generation.
