# C4 authoring for SaaS: notation fidelity and catalog coverage (P39–P45)

**Status: approved with recorded decisions, 2026-10-31. P39–P45 are complete. The revised planning follow-up is [P46–P57](build-plan-c4-evolution.md); P46 and P47 are complete and P48 is next.**
[P39 evidence](evidence/p39/README.md), [P40 evidence](evidence/p40/README.md),
[P41 evidence](evidence/p41/README.md), [P42 evidence](evidence/p42/README.md),
[P43 evidence](evidence/p43/README.md), [P44 evidence](evidence/p44/README.md) and [P45 evidence](evidence/p45/README.md) record the implementations, checks and screenshots.
The plan was written after P38 (`f8aeea0`) from a read-only inspection of the editor,
planned-capability catalog, architecture examples, P36/P37 evidence and the Visual Paradigm
C4 guides below. The user's accepted decisions at the end are binding. Each package is
sized for one fresh agent following PLAN.md §15.

Scope guard for every package below: this work is about **designing with C4 in Jeeves**.
No template runtime, recipe, generator output, lockfile or live QRWTY change is in scope.
New model fields are design metadata that generation ignores; golden generator tests must
stay byte-identical. The C4 level 4 (code) remains the generated templates and is not an
editor concern.

## Sources inspected

- Visual Paradigm, [The complete guide to the C4 model](https://www.visual-paradigm.com/guide/the-complete-guide-to-the-c4-model-for-software-architecture/)
  (e-commerce, cloud-native order system, blog platform, ride-sharing examples; 14 images).
- Visual Paradigm, [C4 container diagram: a practical guide](https://www.visual-paradigm.com/guide/c4-container-diagram-a-practical-guide-for-beginners/)
  (blog, mobile task manager, e-commerce microservices; container categories and label rules).
- Visual Paradigm, [Refining container diagrams to component diagrams](https://www.visual-paradigm.com/guide/architectural-decomposition-guide-refining-c4-container-diagrams-to-component-diagrams-2/)
  (decomposition method: controllers, services, facades, security; 5–10 components).
- Visual Paradigm, [Internet banking case study](https://www.visual-paradigm.com/guide/c4-model-case-study-modernizing-internet-banking)
  and [What is the C4 model](https://www.visual-paradigm.com/guide/what-is-the-c4-model-a-comprehensive-guide-to-visualizing-software-architecture/)
  (task-management example at all four levels; element properties).
- Jeeves: `packages/spec/src/planned-capabilities.ts`, `architecture.ts`, `architecture-view.ts`,
  `architecture-examples.ts`, `design.ts`; `apps/web/src/draw/nodes/ElementNode.tsx`,
  `apps/web/src/architecture/*`; `docs/evidence/p36`, `docs/evidence/p37` screenshots;
  `~/github/qrwty/jeeves/design.json`; [CATALOG.md](../CATALOG.md).

The Google Lens image link in the request had expired (empty body) and could not be read.

## What a C4 diagram shows (acceptance checklist)

These items are the shared "Done when" rubric. Each package names the items it must satisfy.
They follow the Visual Paradigm guides and c4model.com notation guidance.

| # | Item | Level |
| --- | --- | --- |
| N1 | Every element shows a stereotype (person, software system, container, component, external), a **name**, a **technology tag** (C2/C3 only) and a **one-line description**. | C1–C3 |
| N2 | Containers sit inside a labeled, dashed **system boundary**; people and external systems sit outside it. | C2 |
| N3 | Components sit inside a labeled **container boundary**; neighbouring containers and external systems they use sit outside, visually de-emphasised. | C3 |
| N4 | Data stores use a cylinder; external systems/containers are grey; people have the person glyph. | C1–C3 |
| N5 | Colour identifies element type consistently across views, legend available; status (planned, issue, selected) uses a cue other than the type colour. | C1–C3 |
| N6 | Each view has a title ("Container diagram for X") and fits a 1440 × 900 viewport at ≤ 15 containers / ≤ 10 components without clipping. | C1–C3 |
| N7 | Every relationship has a **verb-phrase label** ("Reads and writes link records"), not a kind name ("calls", "Declared use"). | C1–C3 |
| N8 | C2/C3 relationships show a **protocol** ("HTTPS/JSON", "SQL", "AMQP"); C1 relationships do not. | C2–C3 |
| N9 | Synchronous calls are solid, asynchronous/event flows are dashed; "planned" is not expressed by line style. | C2–C3 |
| N10 | No abstraction mixing: C1 has no technology, C2 shows what runs (not where), C3 scopes one container. | C1–C3 |
| N11 | Everything above is reachable and editable by mouse alone, with Save/Cancel, undo/redo and reload continuity. | all |

## Where Jeeves stood before P39

Observed on the P37 QR fixture, the P36 community example and the code.

| Area | Current state | Gap against the checklist |
| --- | --- | --- |
| C1 Context | Person, external system, system cards with description and labeled relationships; setup state when context is missing (P37). | Meets N1, N4, N5, N7. Fine as is. |
| C2 board cards | Editor cards: icon, name, type label, inline **Subtype `<select>`**, config chips ("Port 8080", "Title …"), attachment mini-boxes. Planned cards show a description; executable cards do not. Technology is the template display name and version. | N1 fails for executable containers (no description, no technology such as "Node.js · Fastify"); the inline select and config chips are editor chrome, not C4 content. |
| C2 boundary and people | No system boundary. Context people/external systems appear only when a context relationship is explicitly bound to a container. | N2 fails; the QRWTY C2 shows three boxes with no actor and no boundary. |
| C2 relationships | Executable edges labeled by kind ("calls", "uses database"). Planned edges store label/protocol/interaction/security but render the label only. Dashed line means "planned". | N7, N8, N9 fail. Dashed-for-planned conflicts with the C4 async convention. |
| C3 view | Responsibility groups (P36/P37) with operations on selection; derived technical nodes ("HTTP resource boundary", "Typed API adapter"); edges to containers labeled "Declared use" / "Uses store". Container boundary and neighbouring data store shown. | N3 partly met. N7 fails ("Declared use"). Technical nodes sit among business responsibilities. Frontend C3 has only two derived nodes and no planned component families. |
| C2 catalog | 20 planned container families: 3 clients, API, worker, realtime, gateway, load balancer, CDN/edge, identity provider, relational, document, cache, object storage, search, job queue, event stream, notification service, billing integration, observability. | Missing families that appear in every SaaS example: generic **third-party service** (payment, e-mail delivery, SMS, push, maps, CRM, AI API), **analytics store / warehouse**, **serverless function**, an **audience** choice for web clients (customer vs admin console). No free-text technology on any block. |
| C3 catalog | 6 planned component families: domain responsibility, authorization, feed, moderation, analytics, media. All target service/worker hosts. | Missing **integration adapter/facade**, **notifications**, **billing & plans**, **organizations & members**, **developer API & webhooks**, **reports & exports**, **search & indexing**, **scheduled jobs**, **event handlers**, **audit log**, and every **client-side** family (screen group, client session, API facade). |
| Examples | Three planning studies (links/QR, community, social). Miniatures are identical for all three. | No QRWTY-as-SaaS target example; existing examples lack technology tags and verb/protocol labels and omit identity, billing, e-mail provider, CDN, observability. |
| Design assistant | Chat tools know registered templates only; `apps/server/src/chat` has no reference to planned capabilities. | "Make me an app like bit.ly" cannot place planned blocks or C3 responsibilities. |
| Dynamic / deployment | Read-only local deployment view exists. No runtime-scenario (dynamic) view. | Optional in C4; the scan → redirect flow is the obvious QRWTY case. |

## Packages

Each package: one fresh agent, current branch, local `P<n>:` commit, handoff entry, `pnpm check`,
the named browser suites, inspected screenshots, CATALOG.md kept current. Packages are
ordered; P44 and P45 can be dropped or reordered by the user.

### P39 — C4 container notation on the C2 board

**Completed 2026-10-31.** [Evidence and limitations](evidence/p39/README.md); implementation and verification are recorded in the latest [handoff](handoff.md).

**Goal.** The C2 board reads as a C4 container diagram (N1, N2, N4, N5, N6) while remaining
the editor.

**Build.**
- Add optional `description` (≤ 240 chars) to `elementSchema`, `updateElement` and the element
  inspector. Generation ignores it; planned cards stop borrowing the first 120 chars of notes.
- Technology tag: a spec-level display map for implemented templates (for example
  "Node.js · Fastify", "React · Vite", "PostgreSQL 17") and a free-text `technology` field on
  every planned block, defaulting from an engine option where one exists ("Redis compatible").
  Manifests stay unchanged.
- Card layout: stereotype label, name, technology, description; at most two config chips;
  attachments as a compact icon row. Remove the inline Subtype select; clicking the type label
  opens the same reviewed subtype menu, and the inspector keeps the control. Semantic zoom
  hides description and chips below a zoom threshold.
- Derived system boundary: a dashed frame labeled with the architecture system name around
  all non-external elements; not a layout annotation and not persisted. Context people and
  external systems with a system relationship render outside it; a relationship bound to a
  container points at that container, an unbound one points at the boundary.
- C2 scope header matching C3 ("QRWTY · Applications and data stores").

**Done when.** QR architecture fixture and link-platform example screenshots pass N1, N2, N4,
N5, N6 at 1440 × 900 and 390 px dark; e2e edits a description by mouse with Save/Cancel,
undo, reload and conflict retention; subtype changes still pass through the reviewed dialog;
generator golden/ownership tests unchanged; axe passes; `pnpm check` passes.

**Not in this package.** Relationship labels (P40), new catalog entries, templates, runtimes,
generated output, live QRWTY.

### P40 — Relationship labels, protocols and line semantics

**Completed 2026-10-31.** [Evidence and limitations](evidence/p40/README.md); implementation and verification are recorded in the latest [handoff](handoff.md).

**Goal.** Every arrow carries a verb phrase and (C2/C3) a protocol; sync and async differ
visually; "planned" is a badge (N7, N8, N9).

**Build.**
- Optional presentation metadata on executable connections (`label`, `protocol`,
  `interaction`, reusing the planned connection fields). Defaults derive from the kind and
  target: `uses-database` → "Reads and writes <target> records · SQL", `calls` → "Calls
  <target> API · HTTPS/JSON". Editable in the connection inspector; validation and generation
  ignore the metadata.
- Edge rendering: two-line label (verb phrase, protocol); solid for request/response, dashed
  for asynchronous, distinct style for streaming; planned relationships show a "Planned" chip.
- C3 edges inherit labels: `usesConnections` shows the connection's label, `usesResources`
  shows "Reads and writes <resource>", declared component relationships show their stored
  description. The strings "Declared use" and "Uses store" disappear. Optional per-use label
  override only if it fits the existing component editor without a new dialog.
- C1 relationships unchanged (no protocol, N10).

**Done when.** No edge on the QR fixture or any example reads a kind name; async planned edges
are dashed and executable edges solid; e2e edits a label and protocol by mouse with undo and
reload; generator tests unchanged; `pnpm check` passes.

**Not in this package.** New element types, chat, dynamic views.

### P41 — C2 catalog: missing SaaS containers

**Completed 2026-10-31.** [Evidence and limitations](evidence/p41/README.md); implementation and verification are recorded in the latest [handoff](handoff.md).

**Goal.** The library covers the containers that appear in real SaaS container diagrams.

**Build** (planned blocks; design options only, no runtime):
- **Third-party service** (role external). Category: Payments, E-mail delivery, SMS, Push
  notifications, Maps & geocoding, Analytics vendor, CRM & support, AI model API, Other;
  authentication: API key, OAuth client, mTLS; inbound webhooks toggle; data shared (text);
  behaviour when unavailable: fail request, degrade, queue and retry.
- **Analytics store / warehouse** (role database). Family: columnar warehouse, time-series,
  data lake; load: streaming, micro-batch, nightly batch; retention; access: internal
  dashboards, customer-facing reports.
- **Serverless function** (role worker). Trigger: HTTP, queue, schedule, storage event;
  timeout target; cold-start tolerance.
- Web application gains **audience** (Customers, Internal staff & admins, Both) and
  **kind** (Single-page app, Server-rendered site, Static marketing site).
- Free-text `technology` on all planned blocks if P39 did not add it.
- Family colours/icons, library search and group filters, validation tests, CATALOG.md
  entries with reuse links.

**Done when.** Each new block places on C2 by mouse, configures with Save/Cancel/undo, shows
its technology tag and description (N1), and appears in CATALOG.md; unit tests cover its
schema; `pnpm check` passes.

**Not in this package.** C3 families (P42), examples (P43), runtimes.

### P42 — C3 catalog: SaaS responsibilities and client components

**Completed 2026-10-31.** [Evidence and limitations](evidence/p42/README.md); implementation and verification are recorded in the latest [handoff](handoff.md).

**Goal.** A component view of a SaaS API, worker or web client can be composed from named
responsibilities, following the Visual Paradigm decomposition (feature responsibilities plus
facades and security), scoped to the host's role.

**Build** (planned component families, `scope: "component"`):
- Service/worker hosts: **Integration adapter** (target external service, retries/timeouts,
  mapping, webhook verification), **Notifications** (channels, templates, preferences),
  **Billing & plans** (plans, trials, entitlements, provider sync), **Organizations &
  members** (teams, invitations, roles), **Developer API & webhooks** (API keys, rate limits,
  outbound webhooks, versioning), **Reports & exports** (formats, async generation,
  retention), **Search & indexing**, **Scheduled jobs**, **Event handlers** (planned
  counterpart of durable-event handlers), **Audit log**.
- Client hosts (new `role: "frontend"` components): **Screen group / feature area** (pages,
  access: public / signed-in / admin, data used), **Client session & access**, **API
  facade** (planned twin of the implemented typed adapter), **Local state & offline sync**
  (mobile/desktop).
- Library offers only families compatible with the selected container's role. Optional
  free-text `technology` per component (for tags like "REST controller", "Repository").
- Technical derived nodes ("HTTP resource boundary", "Typed API adapter") move behind a
  "Show technical components" toggle, default off, if the user confirms (decision D9).
- CATALOG.md C3 table and reverse links updated.

**Done when.** Each family can be added inside a selected application by mouse with a verb-
labeled relationship to a container or component (N3, N7); the QR fixture C3 still shows
every operation exactly once; unit tests cover schemas and role filtering; `pnpm check` passes.

**Not in this package.** Page-flow routing semantics, generation of any component, chat.

### P43 — QRWTY target architecture example and example refresh

**Completed 2026-10-31.** [Evidence and inspected views](evidence/p43/README.md);
[study and proposed technologies](examples/qrwty-target.md). Verification is recorded
in the latest [handoff](handoff.md).

**Goal.** One reviewed, editable C1–C3 planning example of QRWTY as a SaaS that exercises the
new blocks, separate from the live project, plus the three existing examples brought up to the
checklist.

**Content (proposed, for review).**
- C1: Link owner, Team administrator, QR visitor, Destination website, E-mail delivery
  provider, Payment provider.
- C2: Owner web app (customers), Admin console (staff), Application API, Redirect service,
  Primary data (PostgreSQL), Lookup cache, Artwork storage, Visit queue, Analytics worker,
  Analytics store, CDN & edge, Billing provider, E-mail delivery, Observability.
- C3 Application API: Accounts & sessions, Organizations & members, Link management, QR
  artwork, Analytics queries, Billing & plans, Developer API & webhooks, Notifications
  adapter. Redirect service: Destination lookup, Visit capture. Analytics worker: Visit
  aggregation, Scheduled exports, Notification delivery. Owner web app: Public landing &
  sign-in, Library & create, Studio, Analytics, Settings & billing (screen groups).
- Every element has technology and description; every relationship has a verb phrase and
  protocol; example miniatures reflect their actual composition.

**Done when.** Screenshots of the example's C1, C2 and each C3 view pass N1–N10 at 1440 × 900;
C2 has ≤ 15 containers and each C3 ≤ 10 components; e2e creates the example from the library
and navigates every level by mouse; existing example tests updated; `pnpm check` passes.

**Not in this package.** Any change to the live QRWTY project or its saved design.

### P44 — Design assistant knows the library

**Goal.** "Make me an app like bit.ly" draws planned containers and responsibilities with
descriptions and labeled relationships instead of "needs a template" boxes.

**Build.** Chat catalog/tool context includes planned C2/C3 families and their options;
`applyOperations` accepts planned elements, `description`/`technology`, planned connection
metadata and `setArchitecture` components; prompt rules encode the checklist (verb labels,
one-line descriptions, ≤ 15 containers, no technology at C1). Scripted fake-provider test:
a bit.ly brief produces C1 actors, a planned C2 and one C3 in a single undo step.

**Done when.** The scripted conversation passes; an unknown capability still becomes a
planned block or "needs a template" rather than an invented ID; a manual smoke with a real
provider is recorded if credentials exist; `pnpm check` passes.

### P45 — Dynamic (runtime) scenario view (optional)

**Completed 2026-10-31.** [Evidence and inspected views](evidence/p45/README.md); verification is recorded in the latest [handoff](handoff.md).

**Goal.** Explain a key flow as numbered steps over existing relationships, as a C4 dynamic
diagram does, without creating new wiring.

**Build.** `architecture.scenarios[]`: id, name, scope (containers or one component view),
ordered steps each referencing an existing connection or component relationship plus a short
text. Rendering overlays step numbers on the referenced edges and lists the steps beside the
diagram; a scenario picker in the diagram menu; mouse editing with Save/Cancel/undo.

**Done when.** The QRWTY example has "Visitor follows a QR" and "Owner creates a link"
scenarios; a step cannot reference a missing relationship; e2e covers add/reorder/remove;
`pnpm check` passes.

## Definition of done for the whole effort (proposed)

A person who knows C4 but not Jeeves can open the QRWTY target example, read C1, C2 and each
C3 view as they would read the Visual Paradigm examples, and then model a comparable SaaS of
their own from the library by mouse alone, with every box and arrow meeting N1–N11. Screenshots
of the result sit beside the Visual Paradigm container/component examples in the evidence
folder for direct comparison. Generated output for existing designs is byte-identical.

## Decisions recorded 2026-10-31

The user accepted every recommended default. These are binding for P39–P45:

| # | Decision |
| --- | --- |
| D1 | No template, runtime, recipe or generator-output change. New fields are design metadata that generation ignores; implemented-template technology tags live in a spec display map, not in manifests. |
| D2 | Remove the inline Subtype select from C2 cards. The type label opens the same reviewed menu; the inspector keeps the control. |
| D3 | The system boundary is derived automatically around all non-external elements; it is not drawn or persisted. |
| D4 | C2 shows every context person/external system that has a system relationship: pointing at the boundary when unbound, at the container when bound. |
| D5 | Dashed lines mean asynchronous. Planned is a badge, never a line style. |
| D6 | One generic "Third-party service" block with a category option, not one block per vendor type. |
| D7 | Client-side C3 families (screen group, client session, API facade, local state) are added now as planning-only; page-flow routing stays a separate later package. |
| D8 | All ten listed service/worker C3 families are in scope. |
| D9 | Derived technical nodes ("HTTP resource boundary", "Typed API adapter") sit behind a "Show technical components" toggle, default off. |
| D10 | The QRWTY example is a labeled target architecture and includes teams, billing, developer API, admin console and CDN. |
| D11 | P45 (dynamic scenario view) is in scope, after P43. |
| D12 | P44 (chat) runs after P42 so the catalog is complete. |
| D13 | The definition of done above stands as written. |
| D14 | Evidence screenshots at 1440 × 900 light and 390 px dark. |
| D15 | The expired Lens image is dropped; the Visual Paradigm guides are the reference. |
| D16 | Commit planning documents immediately. Work on `main`, one agent at a time; no branches or worktrees. Commit history is disposable. |

Status: **P39–P45 are complete.** The revised planning follow-up is [P46–P57](build-plan-c4-evolution.md); applicable decisions above continue to constrain it. The original unapproved D17–D30 follow-up questionnaire is superseded.
