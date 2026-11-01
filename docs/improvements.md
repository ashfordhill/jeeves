# Deterministic application behavior and the qrwty proof

**Current design priority (2026-10-31):** improve C2/C3 authoring, relationships and reusable
composition before new code-generation/runtime work. The [revised P46–P57 roadmap](build-plan-c4-evolution.md)
is the planning specification, incorporating the [direction review](reviews/c4-direction-review-2026-10-31.md)
and [C4 modeling guidance](c4-modeling.md). P46–P55 are complete. P56 is next when execution is requested; proceed one package at a time.

**Previous milestone: [P45 — Dynamic runtime scenarios](build-plan-c4-saas.md#p45--dynamic-runtime-scenario-view-optional), complete.** [P45 evidence](evidence/p45/README.md) records saved C2/C3 scenarios, numbered relationship overlays and mouse editing/history. The approved P39–P45 sequence is complete. P46–P57 replaces the unapproved D17–D30 proposal with bounded contracts, policies, views, patterns, review, target workspaces, deployment intent, scenarios, local reuse and implementation handoff. P44's assistant/catalog, P43's separate [QRWTY target](examples/qrwty-target.md), [P38's API reference](build-plan-p38-api.md) and [P37's shell](build-plan-p37-editor.md) remain the foundation. Maintain [CATALOG.md](../CATALOG.md); runtime availability is unchanged. Code-level implementation, new runtimes/generation, provisioning and live adoption remain separate. Live QRWTY has not adopted P35.

**Latest implemented: [P55 — User-defined reusable architecture library](evidence/p55/README.md).** Save a portable C3 responsibility or C2 composition, review required roles/contracts and guarantees, publish immutable local versions, and insert independent editable instances through mouse/chat. Version/content provenance survives customization, v2 publication and retirement; [local library authoring](architecture-library.md) supplies no runtime or verification. P56's combined QRWTY/non-QR proof is next.

**JEEVES-2 choices resolved:** focused C4 implementation with linked data/traffic settings, contextual menus for retained actions, and C3 responsibility groups. The [research review](reviews/jeeves-feedback-2-2026-10-31.md) remains background and must not be repeated. P38's specification records this bounded package and follow-up boundaries.

Status: the original architecture was approved on 2026-10-29 (see SRC-18 in `docs/sources.md`); P1–P35 and the qrwty proving run are complete as recorded in `docs/handoff.md`. The current priority is C4 authoring UX, with QRWTY as the proving application and reusable templates as the implementation foundation. The earlier [product review](reviews/jeeves-qrwty-product-plan-2026-10-30.md) supplies background; its P12-next statements are historical. The owner-scoped resource pattern, React Flow/outer-only executable connections and ownership protections remain in force until a later package explicitly evolves them. Historical descriptions and handoffs below remain evidence of their original scope.

## Evidence and scope

The existing generator, versioned runtimes, generated-file hashes, project-owned extension points, validated operations API, and separate semantic/layout documents remain the foundation. The previous baseline was 410 unit tests and 17 Playwright tests. Browser tests use scripted providers. S13 reached generation and planning on real providers, then stopped on the first coding task because of provider credits. No completed, exercised real-model application was demonstrated.

The next proof is qrwty: accounts, private QR resources, downloadable QR images containing stable redirect URLs, destination editing, redirects, and request counts over time. Scans mean requests, not unique visitors. Docker Compose is the first deployment target. Hardware, printers, location capture, maps, billing, custom domains, Kubernetes, messaging transports, cloud/enterprise deployment, benchmarks, and rebuilding Jeeves with itself are later work.

## Confirmed editor behavior

1. Place a Service rectangle, then choose its subtype on the rectangle or in the inspector. An untyped service is a valid incomplete design with a readiness finding.
2. Selecting a service reveals its compatible optional components, shown inside the service. Use the current attachment representation internally where it fits. Keep cohesive behavior together; do not add a component dependency framework.
3. Changing subtype shows the specific configuration/components/connections that would be discarded and asks for confirmation if customized data would be lost. Cancel preserves the complete design. Apply the confirmed change atomically through validated operations.
4. Databases are separate top-level elements with a cylinder or another distinct database shape.
5. All arrow endpoints are outer elements. An internal component can supply a connection capability, but never gets a visible handle or a semantic endpoint of its own in the new format.
6. Infer a connection only if exactly one compatible capability pair exists. Otherwise show explicit choices in the inspector. Reconnection uses the same validation as creation. Required configuration stays visible as a finding.
7. Saving incomplete work is supported. Generating an executable partially wired application with stubs is low priority.

The user approved retaining React Flow after [the runnable comparison and evidence](editor-provider-review.md). Implement the approved interactions in the production editor; the comparison remains a temporary spike.

## Small structured resource pattern

Extend `packages/spec` and template configs. Do not create another application document or infer behavior from arbitrary prose. The following TypeScript describes the approved Zod output types; implement Zod as the only runtime/schema authority and model tools receive JSON Schema exported from it.

```ts
type Field =
  | { id: string; name: string; type: "text"; required: boolean; maxLength: number }
  | { id: string; name: string; type: "http-url"; required: boolean }
  | { id: string; name: string; type: "timestamp"; generated: "created-at" };

type Resource = {
  id: string;                 // stable design identity; rename does not replace storage
  name: string;               // editable identifier; generated names validated for collisions
  access: "owner" | "internal";
  fields: Field[];
  belongsTo: { id: string; resource: string; required: true }[];
  operations: ("create" | "read" | "list" | "update")[];
};

type ResourceConfig = {
  resources: Resource[];
  extensions: {
    id: string;
    operationId: string;
    method: "GET";
    path: string;
    access: "public" | "owner";
    acceptance: string[];     // references to fixed, project-specific acceptance cases
    notes: string;            // remaining implementation requirement
  }[];
};
```

Each resource has an implicit UUID primary key. `owner` adds an immutable server-assigned principal ID and a creation timestamp; clients cannot supply either. `internal` resources have no public CRUD routes. A required `belongsTo` is a generated UUID foreign key; relationships cannot cross service/database ownership. Deletion, arbitrary queries, expression languages, inheritance, dependency resolution, and configurable workflows are deliberately absent. Add field types and operations only for demonstrated needs.

Placement: add this config to the existing REST server attachment in the owning HTTP service. The HTTP service owns its resources and connects to one explicitly selected Postgres connection for them. Postgres owns deployment and isolated database/role provisioning. The REST client consumes the service's generated contract, avoiding imports of another template's generator internals. Accounts/session storage belongs to the selected authentication implementation; it is not an independently drawn Login service.

Concrete qrwty resource config:

```json
{
  "resources": [
    {
      "id": "qr", "name": "qr", "access": "owner",
      "fields": [
        { "id": "destination", "name": "destination", "type": "http-url", "required": true },
        { "id": "title", "name": "title", "type": "text", "required": false, "maxLength": 120 }
      ],
      "belongsTo": [],
      "operations": ["create", "read", "list", "update"]
    },
    {
      "id": "scan", "name": "scan", "access": "internal",
      "fields": [
        { "id": "occurred-at", "name": "occurredAt", "type": "timestamp", "generated": "created-at" }
      ],
      "belongsTo": [{ "id": "scan-qr", "resource": "qr", "required": true }],
      "operations": []
    }
  ],
  "extensions": [
    { "id": "qr-image", "operationId": "downloadQr", "method": "GET", "path": "/api/qr/{id}/image", "access": "owner", "acceptance": ["QR-02", "QR-06"], "notes": "Encode the stable public /q/{id} URL as PNG; never encode destination." },
    { "id": "redirect", "operationId": "followQr", "method": "GET", "path": "/q/{id}", "access": "public", "acceptance": ["QR-03", "QR-04", "QR-07"], "notes": "Read the current destination, append a scan event transactionally, then return a non-cacheable 302." },
    { "id": "activity", "operationId": "qrActivity", "method": "GET", "path": "/api/qr/{id}/activity", "access": "owner", "acceptance": ["QR-05", "QR-06"], "notes": "Return total requests and counts in UTC daily buckets, including days with zero requests." }
  ]
}
```

Resource/field/relationship IDs are scoped to the owning service and immutable after generation. Routes in extensions are full paths; generated CRUD paths are `/api/<resource>` and `/api/<resource>/{id}` for this proposal: POST creates, GET on the collection lists, GET by ID reads, and PATCH by ID updates. Validate operation ID/path collisions, relationship targets, forbidden cycles where required ownership cannot be established, field names, duplicate IDs, operation applicability, and missing acceptance references before generation. Extension request/response contracts must be fixed and validated before model coding; the small example above defines task boundaries, not enough information to invent arbitrary response schemas. Store those contracts with the same validated config, using the existing OpenAPI subset rather than a new contract language. P4 added PNG framing/checksum and redirect-header verification; the qrwty fixed suites add independent QR decoding, URL identity, and request counts. (The earlier sentence that the runtime only extracted JSON body schemas is historical.)


### Generated output example

For `qr`, `destination`, and `title`, Generate writes:

```text
services/qrwty/src/generated/resources/qr.ts   validators, owner-scoped repository, handlers
services/qrwty/src/generated/routes.ts         register create/read/list/update + extensions
services/qrwty/resource-migrations/0001.sql    immutable, hashed schema change
contracts/qrwty.openapi.yaml                   CRUD + fixed extension contracts
frontends/web/src/clients/qrwty.openapi.ts     types from the contract
tests/generated/qrwty/qr.test.ts               independent CRUD/isolation/validation checks
tests/acceptance/qrwty/core.test.ts            fixed project examples, protected from agents
services/qrwty/src/features/qr-image/index.ts  scaffold once; explicit implementation task
services/qrwty/src/features/redirect/index.ts  scaffold once; explicit implementation task
services/qrwty/src/features/activity/index.ts  scaffold once; explicit implementation task
```

Illustrative SQL and handler behavior (P3 uses stable-ID physical names for storage):

```sql
CREATE TABLE qr (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES app_user(id),
  destination text NOT NULL,
  title varchar(120),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_owner_created ON qr(owner_id, created_at, id);
CREATE TABLE scan (
  id uuid PRIMARY KEY,
  qr_id uuid NOT NULL REFERENCES qr(id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_qr_time ON scan(qr_id, occurred_at);
```

```ts
// Generated update uses parameters and the authenticated principal in one query.
const row = await db.query(
  "UPDATE qr SET destination = $1, title = $2 WHERE id = $3 AND owner_id = $4 RETURNING *",
  [input.destination, input.title ?? null, params.id, principal.id],
);
// Missing or another owner's ID => 404. No session => 401 before accessing storage.
```

Create returns 201 with `{id, destination, title, createdAt}`. Read/update return the same shape; title is nullable. List returns `{items, nextCursor}` with fixed keyset pagination (newest creation timestamp then ID; bounded page size), always scoped to the principal. Update requires destination and accepts optional title; ID/owner/createdAt/unknown keys are rejected. PATCH is a partial update: omitted optional fields keep their stored value. `http-url` accepts absolute HTTP/HTTPS URLs without embedded credentials and validates without fetching the destination. Invalid payloads return structured 400 responses. The QR identity is immutable and the redirect path derives from that ID. Only the server constructs the public origin from deployment configuration; request Host headers cannot change downloaded QR identity.

### Operations and migration compatibility

Add validated resource/config operations to the existing operations union, or initially replace typed config through `updateAttachment` atomically. Manual forms and chat use that same route, base revision, all-or-nothing validation, and undo history. A reviewed subtype-change operation lists destructive effects and a revision-bound confirmation; chat must also obtain the confirmation. Moving/resizing never changes semantic revision.

Proposed design format v2 adds outer-only connection endpoints plus capability selection on connection configuration. v1 reads remain supported through an explicit deterministic conversion: lift each attachment endpoint to its parent and retain the attachment ID as the chosen capability. Preserve IDs, configs, notes, and semantic content; record conversion on the next semantic save, never on a layout save. Old template versions remain pinned and runnable. No resource declarations are inferred from old notes. Repeated old calls to different components stay distinct. Missing/ambiguous capability references produce findings instead of guessed wiring.

Regeneration preserves current drift detection and scaffold-once behavior. Generated validators, contracts, wiring, clients, and tests are generated-owned. Extension implementation stays project-owned. Migration files are immutable after emission; resource IDs and a model fingerprint in the lock drive new numbered migrations. Renames use stable IDs. Adding nullable fields or generated timestamps with defaults is additive; required fields without a backfill, drops, type narrowing, ownership changes, or relationship changes that can lose data are reported with affected objects and block automatic application until a reviewed migration/backfill is provided. Never silently drop storage or rewrite an applied migration. Removing an extension reports retained custom files and never deletes them automatically.

## Initial connection definitions

| Kind | Compatible endpoints and configuration | Generated wiring | Verification |
| --- | --- | --- | --- |
| `calls` | Outer service with REST client → outer service with REST server; selected capability IDs required when multiple pairs fit; explicit server contract/base path | Internal Compose URL, browser same-origin proxy where appropriate, contract-derived client, dependency readiness | Contract/type conformance, actual request through generated client, malformed input, unavailable destination |
| `uses-database` | HTTP service → Postgres; isolated consumer database/role, chosen resource store when several databases exist | Secret environment references, internal DSN, health dependency, migrations and least-privilege consumer role | Role isolation, migrations twice, create/read/update after restart |

Connection definitions live alongside existing manifest/registry validation and template-kit generation contracts. Do not build a generic transport/dependency framework. Existing `depends-on` designs remain readable; new generation work is limited to REST and Postgres.

## Verification and remaining model work

Report infrastructure readiness, template conformance, and application acceptance separately. Container startup or empty-contract success does not establish application behavior. A required smoke check with zero requests fails with an explanation. Eligible operations missing examples and uncovered required operations are listed by ID. A truly inapplicable check is visibly skipped with its reason. Stateful examples run in isolated fixtures; tests cannot accidentally create production data.

Generated standard behavior tests and fixed project acceptance tests are outside agent-owned paths. Agents may add supplemental tests; they cannot redefine expected behavior. Derive tasks from explicit extension IDs, contract operation IDs, acceptance references, and unresolved behavior. P4 replaced the earlier notes-based seed and unconstrained planner for structured designs; legacy notes-based designs retain compatibility behavior. Do not ask a planner to rediscover service boundaries or standard CRUD. Any post-baseline planner calls count as implementation usage.


## Runs and implementation evidence

Before Start, show generated capabilities, remaining extension tasks, selected coding model, verification layers, and execution mode. Continuous execution is the existing/default mode: continue through verified tasks and stop on problems. The second mode pauses after each verified task for review. A review pause is persisted and occurs only after verification and commit; Resume continues with the next task.

During execution, show progress, current activity, blockers, elapsed time, and implementation usage first. Task prose, paths, logs, diffs, and detailed checks go behind disclosures. Keep design and implementation model selection separate. [Settings recommendations](editor-provider-review.md#provider-and-settings-recommendation) place provider connection/setup first, model choices second, and planner overrides in secondary controls.

Persist an implementation-usage ledger across project → run → task → attempt. Record failed attempts, retries, interrupted calls, and planning after the generated baseline. Keep design-chat usage separate and excluded. Distinguish initial-build and later feature runs while summing both into the project's cumulative total. Missing tokens/cost are unknown, never zero; show known subtotals with coverage. Avoid summing already aggregated run/task values twice. Retain provider/model/settings, design revision/hash, template versions, starting git revision, task prompts, check results, elapsed time, and human interventions (with time and note). Store no credentials in evidence.

## Ordered delivery and review checkpoints

The following list records the earlier delivery sequence. The approved [P39–P45 C4 authoring sequence](build-plan-c4-saas.md) is complete; use its recorded decisions and separately listed follow-ups to specify the next task. Do not restart completed proving work or automatically continue the superseded P35 forms proposal.

1. **Complete and approved.** Record this specification, the schema/output examples, truthful baseline evidence, and [qrwty acceptance](examples/qrwty.md). The user approved the resource pattern before runtime implementation.
2. **Complete; React Flow recommendation approved.** Prototype editor alternatives; document official provider support and Settings behavior. Implement the hierarchy and outer-only connections in the existing production editor. The provider/Settings investigation is documented; production Settings simplification remains outstanding.
3. **Complete: P3.** Implemented schema/operations, production service hierarchy, outer connections, resource/session generation, REST/Postgres wiring, immutable migrations, and safe regeneration. See the P3 handoff for measured checks and compatibility limits.
4. **Complete: P4.** Independent standard/fixed verification in disposable fixtures, protected expectations, nonempty coverage enforcement, PNG/redirect response evidence, and extension-derived tasks. See the P4 handoff for measured checks and limits.
5. **Complete: P5.** Simplified Runs presentation, persisted continuous/review modes, cumulative implementation usage and provenance, and human intervention records. See the P5 handoff for measured checks and limits.
6. **Authentication and boundaries approved:** one API service, one web frontend, one Postgres; email/password with opaque server-managed sessions. Generate qrwty through Jeeves and implement only the approved extensions under fixed tests. Record real-provider failures and human help. After acceptance passes, agree one additive feature and repeat design change/regeneration, preserving code and accumulating usage.
7. **P7–P11 (approved 2026-10-30):** harness correctness, run robustness, OpenCode/Codex provider work and Settings simplification, Generate acceptance packs and the `~/github/qrwty` bootstrap, then the proving run itself. The ordered, file-level work list is [docs/build-plan.md](build-plan.md); it supersedes the "next steps" paragraphs of earlier handoffs.
8. Compare coding models only from identical approved designs/generated baselines, with failed attempts included. Manually initiated comparisons come first; benchmark automation follows a proven workflow.

The user requested a fresh-agent handoff after approval. P5 is complete; continue with the proving application in dependency order. Do not request the same architecture approvals again; seek review only for a material departure. The additive feature after initial qrwty acceptance still needs agreement.

Every delivery runs `pnpm check` and relevant browser/template checks, exercises changed UI by mouse, appends evidence, compatibility notes, limitations, and precise next steps to `docs/handoff.md`, and creates a local Git commit titled with its package ID. Each completed package gets its own commit. The user has given standing authorization for local commits; no permission request is needed. Preserve unrelated changes when staging. Steps awaiting an explicit architectural choice remain proposals, even if a prototype works.


## P3 implementation notes

The authoritative resource schema is `packages/spec/src/resources.ts`. Store it as `rest-api-server.config.model`, with `auth: "session"` and the fixed CRUD base path `/api`. The config adds `storeConnection`, `acceptanceCases`, and a required OpenAPI `contract` on every extension. The earlier qrwty JSON above illustrates intent; the reviewed application fixture is `fixtures/designs/qrwty.json` with fixed suites in `fixtures/acceptance/qrwty/`. `fixtures/designs/resources.json` is a complete technical example, not the qrwty acceptance application.

The production toolbar has a generic Service tool. Subtypes can be chosen inline or in the inspector; compatible components are offered inside a selected service. Connections render only at outer shapes. Multiple REST capabilities produce explicit inspector choices. Changing subtype uses a revision-bound discard list, both in the editor modal and the design-chat `reviewSubtype` human confirmation card. Model tools cannot self-confirm. Nested resource config uses the existing validated JSON form and the same `updateAttachment` operation as chat.

Generation emits per-resource storage/validation descriptors, generated route registration, a complete CRUD/session OpenAPI contract, contract-derived client types, isolated Postgres consumer credentials through environment references, and independent HTTP tests under `tests/generated/<service>/`. The versioned REST runtime executes the fixed repositories/handlers from those descriptors. Session endpoints are `/auth/register`, `/auth/login`, `/auth/session`, and `/auth/logout`; credentials, response shapes and resource inputs derive from Zod. Public extension paths are also proxied at their full path by a connected web frontend. Extension implementations are scaffolded once with no handler registered until implemented. Removed implementations remain on disk and are inactive when their operation is removed from the contract.

Resource migrations are emitted in the owning service's `resource-migrations/` directory, alongside the existing project-owned Drizzle migration directory. The Postgres runtime applies the hashed resource journal under a transaction/advisory lock before project-owned migrations. This keeps the established consumer-owned migration lifecycle. SQL table/column names derive from stable IDs; API renames preserve physical storage. The lock records model fingerprints, selected database identity and all generated hashes. Drops, narrowing, new required fields, relationship/ownership changes and store moves block regeneration before writes. The generator API accepts explicit reviewed SQL for matching previous/next model fingerprints; store transfers remain manual. Existing project-owned contracts are never silently replaced by generated resource contracts.

Legacy v1 documents are converted deterministically on read: attachment choices move into connection config. Layout saves leave stored semantic documents untouched; the next semantic edit/undo writes v2. Existing template references remain pinned, and legacy behavior is covered by the existing template conformance checks. Runtime additions are backward compatible at the existing template versions; old notes do not become resources.

Generated HTTP tests require `JEEVES_TEST_ISOLATED=1`, a loopback `JEEVES_TEST_URL`, and `JEEVES_TEST_PUBLIC_ORIGIN`, and run with Node 24. Owner-parent fixtures with create operations are seeded automatically. Internal/read-only parents and resources without create require explicit isolated fixture IDs. The tests fail when required fixture configuration is missing. P4 integrated these checks into run verification, protected fixed acceptance artifacts, enforced nonempty operation coverage, validated binary/redirect evidence, and derived tasks from extensions. P5 is complete; QR-01–QR-09 remains a separate application milestone.


## P4 implementation notes

Generation accepts human-supplied `fixedAcceptance` suites through the generator library API. Each suite specifies `id`, `service`, `operationIds`, `acceptanceIds`, and Node 24 `node:test` source. Registration validates the operation and acceptance references against the same resource model. Source is emitted under `tests/acceptance/<service>/<id>.test.ts`, hashed in `lock.files`, and registered in `lock.fixedAcceptance`. Regeneration retains suites when omitted from the call; an explicit replacement must still pass ownership checks. Tests and fixtures must establish their own expected behavior before coding. This API is not a browser test authoring tool.

Run checks execute independent generated session/resource tests and required fixed suites with Node directly, separately from project-owned package scripts. Each invocation must execute tests without skipped/todo cases. Expectations are checked for missing files, changed hashes and symlinks. Both `tests/generated/` and `tests/acceptance/` are rejected by agent ownership checks even if a task has broad owned paths. Agents may add supplemental tests inside their allowed service directories.

Stateful suites run against a separate Compose project with fresh named volumes, loopback ephemeral ports, fixture credentials and a fixture public origin. The independent test process receives only fixture variables plus PATH and UTC timezone; ambient credentials and database configuration are not inherited. Writable host mounts, external database hosts and externally named storage are not reused. Cleanup removes fixture containers, volumes and local images even when tests fail or are cancelled. Generated test support currently targets creatable owner resources and creatable owner parents; models needing internal/read-only fixture IDs fail explicitly rather than borrowing application data.

Generated baseline checks defer declared extensions and report their operation IDs as skipped application acceptance. They still execute independent standard behavior. A task requires its own extension and all extensions completed earlier in that run; frontend/other remaining work requires all extensions. A missing runnable fixed suite/reference fails before a coding-agent call. A multi-operation acceptance suite runs only when all its operations are required, so provide an independently runnable fixed suite for each implementation task. Removing a required extension task cannot yield a successful completed run: the terminal check lists the unverified operation IDs. A green baseline is not finished application acceptance.

Structured service tasks use stable element/attachment/extension keys, fixed operation contracts, acceptance references and narrow feature/test paths plus the service package manifest for exact dependency additions. Stale service/component notes do not create CRUD or architecture tasks. Remaining frontend notes remain explicit work. Structured plans bypass planner inference; legacy notes-based designs retain the existing planner behavior. Replanning currently seeds declared extensions again; cross-run reuse/change detection belongs with the following Runs/evidence and proving-feature work.

Legacy stateless smoke checks now fail required empty coverage and list eligible operations missing examples, even if other requests passed. Error responses do not count as successful examples. Inapplicable checks carry visible skip reasons. Response verification preserves media types and documented headers, checks PNG framing/checksums/decompressed scanlines, and validates redirect headers without following Location. Unsupported non-JSON media fails explicitly. Actual QR decoding, stable URL identity, transaction/request-count semantics, and QR-01–QR-09 remain fixed qrwty acceptance work in the proving milestone.

Generate and attempt details distinguish infrastructure readiness, template conformance and application acceptance, with deferred checks excluded from pass counts. P5 adds the Runs redesign, execution/review modes and usage ledger described below.


## P5 implementation notes

Runs defaults to continuous execution. The execution-mode selector is available before Start and while stopped between tasks. Review mode persists in Postgres and pauses after a verified task is committed when another task remains; Resume starts the next pending task. The final verified task completes the run. Failed attempts still follow bounded retries and provider/problem stops. A generated-design hash change refuses Start/Resume and stops execution between tasks until a new run is planned.

The Runs overview leads with progress, current activity, elapsed time, blockers, model selection and implementation usage. Generated capabilities and the three verification layers appear before Start. Task prose/paths, logs, diffs, planning/Git details, the usage ledger and provenance are disclosed on demand. Model choices for design and coding stay separate. New-run Git/retry controls are in the sidebar disclosure.

`implementation_usage` stores leaf implementation records: every planner round and every coding attempt, including failures, cancellations, interrupted work and replans. Project/run/task summaries sum those records once. Reported usage is saved before checks and commit; Codex's completed-turn usage can be persisted before the session returns. A restart marks unfinished ledger entries interrupted while retaining reported usage. Missing token/cost reporting stays unknown with known subtotals and separate coverage. The project total includes initial-build and feature runs and excludes design chat. A later run defaults to feature after a successful run; the create API also accepts an explicit kind. Each run retains its predecessor ID.

Evidence includes generated design revision/hash, template versions, starting Git revision, planned coding selection, and each invocation's actual provider/model and prompt/request. Coding records also retain the invocation's starting Git revision and the run's Git/retry/mode settings. Attempt records retain checks/diffs/commits and timings. Actions, task edits/removals/reorders, mode changes and explicit human-help/review notes have timestamps. Only the selected execution settings and model requests enter evidence; provider credentials/configuration objects and environment variables are not copied.

Migration `0005_runs_evidence` imports surviving historical attempt/planner usage. Historical prompts, provenance, previously overwritten planner rounds and removed attempts cannot be reconstructed and are not invented; old run kinds remain unknown. New runs record all later calls. Existing protected tests and disposable verification fixtures are unchanged. Declared extensions are conservatively seeded again on a new run; automatic cross-run reuse/change detection is still separate work for the additive-feature proof. No prior verification is assumed solely from a stable task key.


## P6 implementation notes

The qrwty fixture (`fixtures/designs/qrwty.json`, schema v2) matches the reviewed design with zero findings. It declares the two resources, nine acceptance cases, three extension contracts, `qrcode@1.5.4`, and `hostPort: 5173`; `fixtures/designs/qrwty.layout.json` fixes the board. Its web notes include the complete UI brief plus `data-testid` hooks used by the fixed browser suite.

Fixed acceptance now supports `requires` (`extensions`/`frontend`), a `node` or `playwright` runner, generated-owned support files, and exact test dependencies. `fixtures/acceptance/qrwty/` contains `core`, `qr-image`, `redirect`, `activity`, `restart`, and `browser` suites; the Node suites use independent `jsqr`/`pngjs` decoding, local destination servers, and controlled DB/Compose fixture access. A frontend suite is visibly skipped until the frontend task. Check outcomes carry `acceptanceIds`, Runs lists extensions and acceptance cases before Start, and a run stops `needs-attention` unless every declared case has a passing suite in that run. Planning rejects a lock whose declared cases have no registered suite.

The disposable fixture publishes the web app on a reserved loopback port, sets every resource service's `PUBLIC_ORIGIN` to that web origin, and passes compose/project/service/web URLs plus a DB element to fixed suites. A restart may republish the service's ephemeral host port, so suites rediscover it through Compose. The real qrwty project uses `127.0.0.1:5173` and a bootstrap-written `.env` (`DB_QRWTY_PASSWORD`, `QRWTY_PUBLIC_ORIGIN`).

Generated ownership text is now derived from the plan: structured contracts, `src/generated/**`, `resource-migrations/**`, `tests/generated/**`, and `tests/acceptance/**` are generated-owned, and element notes put the agent guide before the large model JSON. The http-service, rest-api-server, and rest-api-client guides describe `database.pool`, descriptors, `withTransaction`, `sessionPrincipal`, `publicOrigin()`, binary `parseAs: "blob"`, and extension-only work. PATCH is a true partial update; extension error bodies are documented; adding a generated timestamp is additive.

`pnpm qrwty:bootstrap` applies the fixture through the validated operations API, generates the six suites into the UI's default output folder, writes `.env`, and regenerates without `fixedAcceptance` to prove the lock retains all six. QR-01–QR-09 have not been run; that is the next milestone. No real provider was called.
