# C4 evolution: from a thin live design to a sound SaaS architecture (P46–P53)

**Review required before execution (2026-10-31):** the user has prioritized C2/C3 authoring
and reusable design over new generation/runtime implementation. The [direction review](reviews/c4-direction-review-2026-10-31.md)
identifies corrections to this proposal: responsibility-based C4 classification, logical
message channels, independent tenancy/deployment choices, interface/relationship contracts,
safe pattern reuse and requirement-based advice. P47's generator filtering is deferred;
current/target views can be designed independently. Refine the packages using that review
and the [agent modeling guidance](c4-modeling.md). The original proposal below is retained
for traceability; D17–D30 have not been approved by this review.

**Status: proposed 2026-10-31, awaiting the user's decisions (D17–D30 below).** Written after
P45 (`43dcb5c`) from a read-only inspection of the live Jeeves server, the saved QRWTY
design, the planning catalog, the architecture schema, the P36–P45 evidence, and the
business-analysis reports in `~/github/qrwty/business-analysis/` (the DeepSeek
[SaaS table-stakes brief](../../qrwty/business-analysis/ai-generated-reports-deepseek-v4.1-flash-1017/saas-table-stakes-for-jeeves.md),
its market review, and the Fable market/field/device reports). Those reports analyse
QRWTY as a business; this plan uses them only as a source of **architecture requirements**
for what a hosted QR/link SaaS at qr.io/Uniqode scale must contain.

Scope guard, unchanged from P39–P45: this plan is about **designing with C4 in Jeeves**.
No template runtime, recipe, generated application code or live QRWTY regeneration is in
scope. One package (P47) touches generator *planning* so a design can carry deferred blocks
and still generate its executable subset; its golden tests must stay byte-identical. Code
and template generation for the new SaaS responsibilities come later, in their own plan
(the DeepSeek brief's P-SaaS-1…14 is a reasonable starting point for that later plan).

## Sources inspected

- Live Jeeves API on `127.0.0.1:4310`: project `qrwty`
  (`7dd44cfd-7fbc-4d5a-be79-41c8f58a8993`, revision 17, output `~/github/qrwty`).
- `packages/spec/src/{planned-capabilities,architecture,architecture-view,architecture-examples,validate,findings,design,local-deployment,scenarios}.ts`.
- `apps/web/src/architecture/*`, `apps/web/src/draw/*`, `apps/web/e2e/*.spec.ts`.
- `CATALOG.md`, `docs/build-plan-c4-saas.md`, `docs/evidence/p36`–`p45`, the latest handoffs.
- c4model.com notation for [container](https://c4model.com/diagrams/container),
  [component](https://c4model.com/diagrams/component),
  [deployment](https://c4model.com/diagrams/deployment) and
  [dynamic](https://c4model.com/diagrams/dynamic) diagrams.

## Findings

### 1. The live QRWTY design never received the C4 work

The saved design that the user has been browsing contains three template elements
(`qrwty` http-service + rest-api-server, `qrwty-db` postgres, `qrwty-web` web-app +
rest-api-client), two connections, and **no `architecture` field at all**: no system
description, no people or external systems, no authored components, no descriptions or
technology tags, no scenarios. Findings are empty. Every P36–P45 capability (context editor,
responsibility groups, descriptions, verb/protocol labels, catalog blocks, scenarios) exists
in the editor but was deliberately never applied to this project (decisions D1, D10:
"no live QRWTY change"). The QRWTY *target* lives only as a separate library example.

Consequences the user observed:

| Observation | Cause |
| --- | --- |
| C2 shows three boxes and nothing else | No context nodes bound to the system; no planned blocks around the executable core. |
| C3 shows one box with a list of REST APIs | No authored components, so the projection falls back to derived technical nodes (`architecture-view.ts`: HTTP resource boundary, accounts, one node per resource and per extension operation). |
| The target example looks right but is "somewhere else" | P43 created it as a separate project; there is no path from the live design to it. |

### 2. The live design cannot grow toward the target without losing Generate

A planned block has `template: null`, which `validate.ts` reports as `NEEDS_TEMPLATE`
(severity `error`, category `readiness`); planned connections do the same. Generation
requires zero error findings. So the moment a cache, queue or redirect service is added to
the live design, the project stops generating. The target example therefore has to stay a
separate study. This is the single structural reason the live project is "thin": the model
has no notion of *"this block is part of the design, but not part of this generation"*.

### 3. Catalog soundness against C4

The C2 catalog has 23 families and the C3 catalog 20 (`planned-capabilities.ts`). Against
the C4 definitions, four C2 entries are not containers:

| Block | Current role/group | Problem | Recommendation |
| --- | --- | --- | --- |
| Load balancer | service · Traffic & security | A deployment-time infrastructure node. On a container diagram it hides *what runs*; the c4model places it on the deployment diagram. | Move to an `infrastructure` role shown on a deployment view (P51); hidden from C2 by default. |
| API gateway | service · Traffic & security | Legitimately a container **only** when it is deployed software with behaviour (auth, rate limits, routing rules). A managed cloud gateway is infrastructure. | Keep as a container with a "managed / self-hosted software" option; the managed choice renders on the deployment view only. |
| CDN & edge protection | external · Traffic & security | Caching/TLS/abuse policy is an edge *deployment* concern. It appears in container diagrams only when it hosts content. | Infrastructure role; on C2 shown only when it serves client assets or artwork (as the target does). |
| Observability | external · Operations | Logs/metrics/traces collection is cross-cutting; drawing a "container" that every container "uses" adds N arrows and no information. | Infrastructure role, rendered as a deployment-view node and a system-level property, not an arrow target on C2. |

Two blocks duplicate others: **Notification service** (service role) overlaps the
**Third-party service** category *Push/E-mail/SMS* and the C3 *Notifications* family;
**Billing integration** (external) duplicates *Third-party service: Payments*. Each should
become a preset of the third-party block (D18), so the library offers one external boundary
with a category rather than three overlapping ones.

The rest of the C2 catalog is sound: clients, application API, worker, serverless, realtime,
identity provider, relational/document/analytics stores, cache, object storage, search, job
queue, event stream, third-party service. Queues/streams as `service` role is fine (brokers
are containers). Nothing important is missing at C2 for a SaaS; reverse proxies, secrets
managers and schedulers are deployment or component concerns.

The C3 catalog covers the DeepSeek table stakes except four responsibilities that a QR/link
SaaS specifically needs (brief §5.5, §5.11, §5.12, §4.10): **Entitlements & quotas**,
**Abuse & trust/safety** (destination scanning, quarantine, appeals: distinct from content
moderation), **Custom domains & TLS**, and **Data lifecycle & privacy** (export, deletion,
retention). Add those four; the catalog otherwise does not need more C3 breadth. What is
thin is *per-project* C3 authoring (finding 1), not the family list.

### 4. What a qr.io-shaped architecture needs, and whether Jeeves can express it

A hosted dynamic-QR product has two very different workloads: a small management API
(owners editing links, low volume) and a public redirect path (every scan, bursty, must be
fast and must never touch slow stores). The P43 target already models this correctly:
edge → stateless redirect service → lookup cache → primary data on miss; visit capture →
queue → analytics worker → analytics store; management API separate; artwork in object
storage behind the CDN; payment and e-mail providers; teams, billing, developer API, admin
console. The gaps are not in *what* can be drawn but in:

- **Deployment.** Replicas, regions, edge placement, managed services: the level where
  "handle high traffic" is actually answered. Jeeves has only a read-only declared *local*
  deployment (P33) for one http-service; no planned deployment view.
- **Soundness feedback.** Nothing tells a designer that a redirect path reads the analytics
  store synchronously, that a cache has no source of truth, that a queue has no consumer, or
  that a worker has no trigger. All of those are expressible today and silently accepted.
- **Getting there quickly.** Composing the target from the library takes dozens of mouse
  actions and prior knowledge of the shape. There is no reusable "pattern" above the
  single-block level.
- **Decisions and export.** Enterprise design records *why* (ADRs) and shares diagrams
  outside the tool. Jeeves persists neither decisions nor an export of any view.

### 5. Deployment model is a design input

The DeepSeek market review's main point relevant to Jeeves is that "self-host" hides four
deployment models (managed SaaS, customer VPC, on-prem, airgapped) with different
architectures. Jeeves has no place to state which one a design targets. A single
system-level choice (hosted SaaS / private deployment / both) with planning-only
consequences (a second deployment environment, SSO/audit expectations as advice) is cheap
and makes the deployment view (P51) meaningful.

## Where Jeeves stands after P45

| Area | Current state | Gap |
| --- | --- | --- |
| C1/C2/C3 notation | N1–N11 met on examples (P39–P43). | Not applied to the live project. |
| Catalog | 23 C2, 20 C3 planned families; role-filtered; chat-aware (P44). | Four infrastructure blocks mis-levelled; two duplicates; four QR/SaaS C3 families missing; no system-level tenancy/deployment model. |
| Planned ↔ executable | Planned blocks and executable templates coexist in one document; any planned block blocks generation. | No "deferred" horizon; live designs cannot carry the target. |
| Composition speed | One block at a time; chat can draw from a brief. | No pattern fragments; no reuse of an existing block of the same family. |
| Soundness | Structural/readiness findings only. | No architecture advice. |
| Deployment | Read-only declared local view for one service (P33). | No planned environments, nodes, instances, regions; infrastructure blocks drawn as containers. |
| Dynamic | Scenarios over C2/C3 (P45). | None needed now. |
| Decisions / export | None. | No ADRs; no SVG/PNG/DSL export. |
| Layout | Deterministic ELK per view; board layout persisted. | No persisted per-view nudges for C1/C3 (noted as future work since P30). |

## Acceptance checklist additions

N1–N11 from `build-plan-c4-saas.md` remain. Added for this plan:

| # | Item | Level |
| --- | --- | --- |
| N12 | A deployment view shows an **environment** title, **deployment nodes** (region, cluster, host, managed service, edge) with technology and instance count, and **container instances** that reference existing C2 containers by identity. | Deployment |
| N13 | Infrastructure (load balancer, CDN, managed gateway, observability) appears on the deployment view; it appears on C2 only when it is a software container the system runs. | C2/Deployment |
| N14 | A deferred ("later") block or relationship is visibly distinct from a current one on every view, and Generate states exactly what it excluded. | all |
| N15 | Architecture advice never blocks generation, names the elements involved, and offers a pattern or edit that resolves it. | all |
| N16 | Everything above is reachable and editable by mouse alone, with Save/Cancel, undo/redo and reload continuity. | all |

## Packages

Each package: one fresh agent, current branch, local `P<n>:` commit, handoff entry,
`pnpm work run check`, the named browser suites, inspected screenshots at 1440 × 900 light
and 390 × 844 dark, CATALOG.md kept current. Packages are ordered; P52 and P53 can be
dropped or reordered by the user.

### P46 — Catalog soundness: infrastructure role, presets, missing C3 families, system properties

**Goal.** The library offers only C4-sound containers, one external boundary per concern,
the C3 families a QR/link SaaS needs, and a place to state tenancy and deployment model.

**Build.**
- Add role `infrastructure` to `PlannedCapability.role` and the role-compatibility tables.
  Reclassify **Load balancer**, **CDN & edge protection** and **Observability** to it.
  **API gateway** gains a `deployment` option (`Self-hosted software`, `Managed service`);
  managed gateways render like infrastructure. Infrastructure blocks are hidden from the C2
  board by default behind a "Show infrastructure" toggle (same pattern as P42's technical
  components); they keep their identities, options and relationships.
- Turn **Notification service** and **Billing integration** into presets of **Third-party
  service** (category `Notification delivery`, `Payments`) with a migration of existing
  documents and examples: a `planned` id rewrite in `upgradeDesign` or a registry alias, so
  saved designs and the four examples keep validating with no semantic change.
- Add C3 families (service/worker hosts): **Entitlements & quotas** (plan limits, usage
  counters, hard/soft limit behaviour, downgrade policy), **Abuse & trust/safety**
  (destination scanning, verdicts, quarantine, reports, appeals), **Custom domains & TLS**
  (ownership verification, certificate issuance/renewal, takeover protection), **Data
  lifecycle & privacy** (export, deletion, retention, anonymisation). Each with bounded
  options, family colour/icon, role compatibility and CATALOG entries with reuse links.
- System properties on `architecture.system`: `tenancy` (`Single user`, `Per user`,
  `Organizations`, `Dedicated per tenant`), `deploymentModel` (`Hosted SaaS`,
  `Private deployment`, `Both`), `scaleTarget` (free text ≤ 80). Editable in the context
  inspector; shown in the C1 system card. Planning-only; generation ignores them.

**Done when.** Library shows no infrastructure block in the default C2 palette and shows
them under "Show infrastructure"; the four examples and the saved e2e fixtures load, validate
and render unchanged after the preset migration (screenshots compared with P43 evidence);
each new C3 family places by mouse with Save/Cancel/undo/reload; system properties
Save/Cancel/undo/reload; unit tests cover role tables, migration and schemas; generator
golden/ownership tests unchanged; `pnpm check` passes.

**Not in this package.** Deployment view (P51), patterns, advice, live QRWTY.

### P47 — Horizons: deferred blocks that do not block generation

**Goal.** One design can hold the current executable application *and* the planned target
around it, and still generate the executable subset.

**Build.**
- Optional `horizon: "now" | "later"` on elements and connections (default `now`). A planned
  element or planned connection with `horizon: "later"` produces a new readiness finding
  `DEFERRED` with severity `warning` instead of `NEEDS_TEMPLATE`; executable elements cannot
  be `later` (CONFIG_INVALID). A `now` planned block keeps today's `NEEDS_TEMPLATE` error, so
  nothing silently changes for existing designs. Connections touching a `later` element are
  `later`; executable ports are validated only among `now` elements.
- Generator planning (`packages/generator/src/plan.ts`) filters `later` elements and their
  connections before anything else runs; `generate.ts` records the excluded ids in
  `jeeves/lock.json` under `deferred` and in the Generate drawer ("Not generated: Lookup
  cache, Visit queue, …"). The design snapshot keeps them losslessly. Golden fixtures with
  no `later` blocks are byte-identical.
- Presentation: "Later" badge and a lighter outline on C2/C3 cards and edges, legend entry,
  a card/inspector toggle "Horizon: now / later" with Save/Cancel/undo, and a C2 filter
  "Current only / Current and later". Scenarios may reference `later` relationships; the step
  list marks them.
- Chat: the assistant can set the horizon; prompt rule: blocks added around an existing
  generatable application default to `later`.

**Done when.** The QRWTY architecture fixture plus three `later` planned blocks generates
byte-identical output to the fixture alone (new generator test), the drawer lists the
exclusions, and a `now` planned block still blocks; e2e toggles horizon by mouse with
Save/Cancel/undo/reload and conflict retention; axe passes; `pnpm check` passes.

**Not in this package.** Any runtime for later blocks; recipes; live QRWTY edits (P50).

### P48 — Architecture patterns: insertable fragments

**Goal.** A designer turns a three-box application into a qr.io-shaped SaaS in a handful of
mouse actions, by inserting reviewed patterns rather than individual blocks.

**Build.**
- `packages/spec/src/architecture-patterns.ts`: a catalog of patterns, each with id, name,
  one-line intent, preconditions (host role: e.g. "select an application API"), the blocks it
  adds (family + default options + description + technology), relationships (verb,
  protocol, interaction, direction), C3 responsibilities on the host, optional scenario, and
  the family of existing blocks it may **reuse instead of duplicating** (one queue per
  design unless the user says otherwise).
- Initial pattern set, ordered by the DeepSeek brief and the P43 target:
  1. **Cached public lookup** — redirect service + cache + source fallback; scenario
     "Visitor follows a link".
  2. **Asynchronous event pipeline** — queue + worker + analytics store; async edges.
  3. **Transactional outbox** — when the host is a compatible `http-service`, offers the
     implemented `durable-events` attachment; otherwise an Event handlers responsibility on a
     worker with a queue (D22).
  4. **Edge-protected public endpoint** — CDN/edge infrastructure block (P46) and abuse
     responsibility on the public service.
  5. **Team workspaces** — Organizations & members, Authorization, Audit log responsibilities
     and system tenancy `Organizations`.
  6. **Subscription billing** — Billing & plans + Entitlements & quotas responsibilities,
     Payments third-party block with signed webhook edge.
  7. **Developer API & webhooks** — responsibility + outbound webhook delivery on the worker.
  8. **Transactional e-mail** — Notifications responsibility + E-mail third-party block.
  9. **Reports & exports** — responsibility on API and worker + object storage reuse.
  10. **Admin console** — staff web application with a support screen group.
  11. **Custom domains** — Custom domains & TLS responsibility + edge block.
- Applying a pattern is one operation batch (one undo step), with a preview dialog listing
  what will be added and what will be reused, and a horizon choice (default `later` when the
  design already generates, D21). New blocks are auto-placed near the host (existing ELK
  placement). Library gains a **Patterns** tab with miniatures derived from each pattern.
- Chat tool `applyPattern` with the same preview semantics (P44 context extended).

**Done when.** From the three-element QRWTY architecture fixture, applying patterns 1, 2, 5
and 6 by mouse yields a C2 that passes N1–N10 and N14 with ≤ 15 containers and reuses the
existing data store and API; undo removes each pattern as one step; the scripted chat test
applies a pattern; unit tests cover every pattern's validity on an empty host and on the
target example (no duplicate families, all relationships valid); `pnpm check` passes.

**Not in this package.** New runtimes; the advice rules (P49); live QRWTY (P50).

### P49 — Architecture advice

**Goal.** The findings panel tells a designer when the drawn architecture is unsound, with
the same deterministic honesty as readiness findings, and never blocks generation.

**Build.**
- New finding category `advice` (severities `warning`/`info`) in `findings.ts`, computed by
  `packages/spec/src/advice.ts` over the design, architecture, horizons and (after P51)
  deployment. Initial rules:
  - A1 cache with no request/response relationship to a source-of-truth store.
  - A2 queue or stream with no consumer, or worker with no trigger (queue, schedule, HTTP).
  - A3 a public/unauthenticated hot path (redirect service, or any service a Visitor reaches)
    with a synchronous relationship to an analytics store, search index or external provider.
  - A4 analytics store written synchronously from a request path (should be async).
  - A5 external provider block without a "behaviour when unavailable" choice.
  - A6 data store with no owning application (nothing reads/writes it).
  - A7 container with more than ten authored components; C1 node with technology text.
  - A8 billing or organizations responsibility present while system tenancy is `Single user`.
  - A9 `deploymentModel` is `Private deployment`/`Both` and no identity provider or audit log.
  - A10 an infrastructure block drawn as a C2 relationship target (post-P46 migration aid).
  - A11 two blocks of the same family with identical options and no relationship between
    them (likely duplicate).
  - A12 a scenario step that crosses from an async edge back to a sync response (cannot be
    waited on).
- Each advice finding names its elements, explains the rule in one sentence, and offers a
  fix: "Apply pattern …" (P48), "Edit …", or "Acknowledge". Acknowledging stores
  `{ rule, elements, reason }` in `architecture.acknowledgements` (Save/Cancel, undo) and
  hides the finding until the involved elements change.
- Findings panel groups by category; advice is collapsed when there are errors.

**Done when.** The QRWTY target example produces zero unacknowledged advice; the links
example with its queue consumer removed produces A2; a fixture with a redirect → analytics
store sync edge produces A3; acknowledgement persists across reload and reappears on change;
generation is never blocked by advice (test); e2e exercises fix links by mouse; `pnpm check`
passes.

**Not in this package.** Load tests, capacity claims, runtime checks.

### P50 — Live QRWTY uplift

**Goal.** The project the user actually opens reads as a C4 model of the running
application and carries the target around it, without regenerating or restarting anything.

**Build.**
- **Suggest responsibilities** (deterministic, `packages/spec/src/suggest-components.ts`)
  for an implemented `rest-api-server` host: groups the derived technical nodes into
  authored components by resource and extension naming — for QRWTY: *Accounts & sessions*,
  *QR link management* (qr CRUD), *Redirect & visit capture* (redirect, scan), *QR artwork*
  (studio, preview, save, export, qr-image), *Analytics* (activity, owner analytics) — each
  with a description, technology "Fastify · project extension/generated", members and
  `usesResources`. Presented as an editable draft (the existing component editor), saved as
  one batch. Works for any structured host, not only QRWTY.
- **Suggest context**: proposes people from the auth model (*Link owner* for session-scoped
  hosts, *Visitor* for public extensions), relationships bound to the web/API containers,
  and a system description from the project name. Editable draft, one batch.
- Apply both to the live project through the normal operations API, plus descriptions and
  technology for the three executable elements, verb/protocol labels on the two
  connections, and the two P45 scenarios adapted to the live wiring. Then apply patterns
  1, 2, 4, 5, 6 and 8 as `later` (P47/P48) so the live C2 matches the target's shape with
  the executable core marked current. This is the one package allowed to edit the live
  project's saved design (D24): metadata, architecture and `later` blocks only.
- Prove non-regression without touching `~/github/qrwty`: export the live design snapshot
  through the API into a fixture and show the generator plans the identical executable
  element set and byte-identical generated-owned files against the P11 lock hashes.

**Done when.** The live project's C1 shows owner/visitor/system, C2 shows the current
three containers inside the boundary with the deferred SaaS shape around them, the API C3
shows five responsibilities with every operation exactly once, both scenarios play; the
snapshot generator test passes; screenshots are inspected; the live app on 5173 is
untouched (health check before/after); `pnpm check` passes.

**Not in this package.** Regenerating, migrating or restarting QRWTY; recipe adoption.

### P51 — Deployment view

**Goal.** Answer "how does this handle traffic and where does it run" on a C4 deployment
diagram, planning-only, with the local declared deployment as one derived environment.

**Build.**
- `architecture.deployments[]`: environment id/name/kind (`Local Docker`, `Hosted cloud`,
  `Private deployment`), nodes (kind: region, cluster, host/VM, managed service, edge, device;
  technology; instance count; optional parent node), container instances (reference an
  existing element id; replicas; optional node), infrastructure placements (P46
  infrastructure blocks live here), and relationships between instances that reuse C2
  connections by identity (no new wiring). Validation: instances reference existing
  elements; a `later` element may appear only in a non-local environment; nested nodes
  acyclic; bounds on counts.
- The **Local Docker** environment is derived read-only from the existing P33 declared
  local deployment and the compose plan (one instance per executable element, pool
  replicas when configured). Editable environments are planning-only and never claim
  capacity (N15 text in the legend).
- A **Deployment** scope beside C1/C2/C3 in the architecture workspace: environment picker,
  nested node frames, instance cards (container identity, replica badge), infrastructure
  nodes, reused relationship labels; mouse editing with the existing dialog pattern,
  Save/Cancel/undo/reload; ELK nested layout via the existing worker.
- QRWTY target example gains a **Hosted cloud** environment (edge, two regions optional,
  stateless redirect replicas, managed Postgres/Redis/queue/ClickHouse, worker pool) and a
  **Private deployment** environment (single cluster, customer identity provider). Advice
  rules A9/A10 consult deployments.

**Done when.** N12–N13 pass on the target's hosted environment screenshot at ≤ 12 nodes;
local environment matches the P33 view for the pooled fixture; e2e adds a node, places an
instance and sets replicas by mouse with Save/Cancel/undo/reload; unit tests cover schema,
derivation and validation; generator tests unchanged; `pnpm check` passes.

**Not in this package.** Provisioning, autoscaling, cloud credentials, cost estimates.

### P52 — Decisions and export (optional)

**Goal.** Record why the architecture is the way it is, and get the diagrams out of Jeeves.

**Build.**
- `architecture.decisions[]` (ADR-style): id, title, status (`proposed`, `accepted`,
  `superseded`, `rejected`), context, decision, consequences (each ≤ 1,200 chars), linked
  element/component/pattern/advice-rule ids, date. Editable list in the architecture
  workspace; cards show a small "n decisions" chip; acknowledging advice (P49) can create a
  decision. Chat may draft a decision for review.
- Export the current C1/C2/C3/deployment view as **SVG** and **PNG** (rendered from the
  existing projection and geometry, not a screenshot) and the whole model as
  **Structurizr DSL** (workspace, model with people/systems/containers/components,
  relationships with technology, deployment environments, dynamic views from scenarios),
  with a Mermaid C4 variant if it fits the same emitter (D26). Downloads by mouse; no
  network.

**Done when.** Exported DSL for the QRWTY target parses with the pinned Structurizr DSL
grammar fixture used in a unit test (text-level, no Java), SVG matches the on-screen view
at 1440 × 900 within the fitted bounds, decisions Save/Cancel/undo/reload; `pnpm check` passes.

### P53 — Persisted per-view layout and diagram polish (optional)

**Goal.** Close the long-standing "custom per-view layouts are future work" note and the
visual items that make the architecture views feel thin.

**Build.** Optional persisted nudges for C1, C3 and deployment nodes in the layout document
keyed by view and node identity (never in the semantic model; a "Reset layout" action
returns to ELK); collapsible groups for ≥ 8 components; a diagram title bar with scope,
environment/horizon filters and legend in one line; consistent empty states that offer the
relevant pattern (P48) or suggestion (P50).

**Done when.** A nudged C3 survives reload and semantic edits that do not remove the node;
reset returns to the deterministic layout; existing layout tests unchanged; `pnpm check`.

## Definition of done for the whole effort (proposed)

Opening the live QRWTY project shows a C4 model a reviewer would accept: context with
owner, visitor and providers; a container diagram with the running core marked current and
the SaaS target marked later; five API responsibilities; two scenarios; a hosted
deployment environment; zero unacknowledged advice. A new user can start from a blank
application, apply four patterns, read the advice, and produce an equivalent design by
mouse alone. Generated output for every existing design is byte-identical, and the live
application was never regenerated.

## Decisions for the user (recommended defaults)

| # | Decision | Recommended default |
| --- | --- | --- |
| D17 | Add an `infrastructure` role and move load balancer, CDN & edge and observability to it; API gateway gains a managed/software option. | Yes. |
| D18 | Fold Notification service and Billing integration into Third-party service presets with a migration. | Yes. |
| D19 | Add the four C3 families (Entitlements & quotas, Abuse & trust/safety, Custom domains & TLS, Data lifecycle & privacy). | Yes. |
| D20 | System-level `tenancy`, `deploymentModel`, `scaleTarget` on C1, planning-only. | Yes. |
| D21 | A `later` horizon lets a design keep generating its executable subset; `now` planned blocks still block. This touches generator planning (filter only) and lock metadata. | Yes; the alternative is keeping the target forever separate. |
| D22 | Patterns prefer an implemented template/attachment when the host is compatible (durable-events for the outbox), otherwise planned blocks. | Yes. |
| D23 | Advice never blocks generation; acknowledgement stores a reason in the design. | Yes. |
| D24 | P50 may edit the live QRWTY *saved design* (metadata, architecture, `later` blocks) through the API; it may never regenerate, migrate or restart the application. | Yes. |
| D25 | Deployment view is planning-only; the Local Docker environment is derived from P33 and read-only. | Yes. |
| D26 | Export formats: SVG, PNG and Structurizr DSL; Mermaid C4 only if the same emitter covers it. | Yes. |
| D27 | Order P46 → P47 → P48 → P49 → P50 → P51 → P52 → P53; P52/P53 optional. | Yes. |
| D28 | Chat gains `applyPattern` and horizon awareness in P47/P48 rather than a separate chat package. | Yes. |
| D29 | The deployment-model default for the QRWTY target is `Both` (hosted SaaS first, private deployment as a second environment), reflecting the market reports. | Yes. |
| D30 | Evidence screenshots at 1440 × 900 light and 390 × 844 dark; D1–D16 remain binding. | Yes. |

## Open questions

1. Should the live QRWTY project become the design of record (grown in place with `later`
   blocks, P50) and the separate target example be retired after P50, or should both be
   kept? Recommendation: keep the example as a library study; the live project is the
   design of record.
2. Does the user want the four reclassified infrastructure blocks hidden on C2 by default
   (recommended) or always visible with an infrastructure stereotype?
3. Any pattern to add or drop from the initial eleven? Candidates not included: search &
   discovery, realtime fan-out, mobile client with offline sync.
