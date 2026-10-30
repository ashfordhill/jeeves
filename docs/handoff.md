# Handoff log

Append-only. Each build agent adds one entry at the end when its section is done (PLAN.md §15). Don't edit earlier entries.

---

## S1: Repository foundation and editor extraction (2026-10-28)

### Built

- pnpm monorepo per PLAN §14: `apps/web`, `apps/server`, and empty `packages/{spec,registry,generator,orchestrator,providers}` (each has `package.json`, `tsconfig.json`, and a placeholder `src/index.ts`). `pnpm-workspace.yaml` already includes `templates/*` for S2.
- Tooling: TypeScript 7.0.2 (`tsconfig.base.json`, strict + `noUncheckedIndexedAccess`), Biome 2.5.15 for lint and format, Vitest 5 with one root config whose projects are `apps/*` and `packages/*`, Playwright 1.63 + axe. Root scripts: `dev`, `db:up`, `db:down`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `test:e2e:docker`, `check`.
- `compose.yaml`: Postgres 17 on `127.0.0.1:54329` (user/password/db `jeeves`), with a health check, so `docker compose up --wait` works.
- `apps/server`: Fastify on `127.0.0.1:4310`. `buildApp({ pingDb, version })` in `src/app.ts` is separate from `src/main.ts` so tests use `app.inject` without Postgres. `GET /health` returns `{ status, database, version }`: 200 when `select 1` succeeds through Drizzle, 503 `degraded` otherwise. Drizzle (`node-postgres` driver) in `src/db/client.ts`, empty `src/db/schema.ts`, and `drizzle.config.ts` (migrations output to `apps/server/drizzle/`). Config from env: `JEEVES_SERVER_PORT`, `DATABASE_URL`.
- `apps/web`: Vite on `127.0.0.1:4300`, proxying `/api/*` to the server with the `/api` prefix stripped. Shell with automation-pitch's Ice theme, Nunito, Mantine theme, paper texture (on Draw), chrome header with Draw / Runs / Settings tabs (selected tab in the URL hash), and a status bar with server health (polls every 5 s), a dark-mode toggle (stored in localStorage), and the version.
- `docs/reference/editor-extraction.md`: what was copied, what's left for S4–S6, and what was left behind.
- `AGENTS.md`, `README.md`, `.nvmrc` (24.21.0), `scripts/e2e-docker.sh`.

### Commands and results

`pnpm install && pnpm check`:

```text
$ biome check .
Checked 52 files in 9ms. No fixes applied.
$ pnpm -r --no-bail typecheck
apps/web typecheck: Done
apps/server typecheck: Done
packages/{generator,orchestrator,providers,registry,spec} typecheck: Done
$ vitest run
 Test Files  3 passed (3)
      Tests  5 passed (5)
```

`pnpm dev`, then:

```text
$ curl http://127.0.0.1:4310/health        → {"status":"ok","database":"ok","version":"0.1.0"} 200
$ curl http://127.0.0.1:4300/api/health    → {"status":"ok","database":"ok","version":"0.1.0"} 200
```

`pnpm test:e2e:docker` (see known issues for why not `pnpm test:e2e`):

```text
  ✓  1 [chromium] › apps/web/e2e/shell.spec.ts:4:1 › loads the shell, reports a healthy server, and switches views (1.2s)
  1 passed (3.2s)
```

The e2e test loads the shell, waits for "Server healthy" (real Postgres), switches to Settings, reloads and checks the tab stuck, and asserts zero axe violations. Screenshots of light (Draw) and dark (Runs) were checked by eye.

### Deviations and choices the plan left open

- **Biome instead of ESLint + Prettier.** One tool, no plugin set, and it doesn't depend on the TypeScript compiler API, which matters because we're on TypeScript 7 (the native compiler) to match automation-pitch. CSS `!important` is allowed because the shell overrides Mantine's styles, as automation-pitch does.
- **`compose.yaml`** at the repo root, not `docker-compose.yml`, so it doesn't look like a generated project's compose file.
- **`pnpm dev` starts Postgres** (`docker compose up -d --wait`) before running both apps with `pnpm --parallel`. No `concurrently` dependency.
- **No Mantine `AppShell` yet.** The shell is a header, an absolutely positioned stage, and a fixed status bar. S5 should switch to `AppShell` with an aside when it adds the inspector (see automation-pitch `App.tsx`).
- **`fastify-type-provider-zod` isn't installed yet.** `/health` didn't need it and it has a `@fastify/swagger` peer. S3 should add it with its first Zod-validated routes.
- **Sounds** weren't added; nothing in the empty shell warrants a cue.
- pnpm 12 blocks dependency build scripts by default; `pnpm-workspace.yaml` allows `esbuild` (needed by `tsx` and `drizzle-kit`).

### Known issues

- Chromium's system libraries were missing on this machine at first (`libnspr4.so`). The user installed them, and `pnpm test:e2e` now passes natively (1 passed). `pnpm test:e2e:docker` stays as a fallback for machines without them.
- pnpm is now a standalone install in `~/.local/share/pnpm/bin` (added to PATH in `~/.bashrc`), not the Corepack shim. Non-interactive shells that skip `.bashrc` need that directory on PATH.
- `drizzle-kit` pulls in deprecated `@esbuild-kit/*` subdependencies (install warning only).

### For S2

- Put template manifests in `templates/<id>/` with a `package.json` named `@jeeves/template-<id>` (or similar); the workspace glob already covers them. Add `"typecheck": "tsc -p ."` and a `tsconfig.json` extending `../../tsconfig.base.json` to every new package so `pnpm typecheck` covers it, and make sure the root `vitest.config.ts` `projects` list includes `templates/*` once they have tests.
- Zod is not installed yet; use `4.5.4` to match automation-pitch.
- Packages import each other through `workspace:*` dependencies and TS-source exports; no build step is needed.

---

## S2: Spec package and template manifests (2026-10-28)

### Built

- **`packages/spec`** (Zod 4.5.4), one file per concern:
  - `ids.ts`: `idSchema` (lowercase slug, at most 63 characters, unique across the whole design because layout is keyed by ID and element IDs become directory names), `templateRefSchema`, `compareVersions`.
  - `design.ts`: the design document (elements with nullable `template` for "needs a template", attachments with their own `notes`, typed connections between `{ element, attachment? }` endpoints, and annotations `text | note | frame | arrow`). Arrows may bind `from`/`to` to any item ID. `emptyDesign()` and `designIds()`.
  - `layout.ts`: the layout document (`items` keyed by ID: x/y/size/collapsed/frame `parent`/`points`, plus `viewport`) and `pruneLayout()`.
  - `manifest.ts`: the template manifest schema (element vs attachment, `elementKind`, Zod config object, presets, ports, `attachmentSlots`, card icon and chips), `defineTemplate()`, the `TemplateLookup` interface, and `findPort()`.
  - `findings.ts`: `findingCatalog`, which gives each code a category (structural / readiness / operation) and a severity. Also `finding()`, `isStructural()`, and `blocksGenerate()`.
  - `config.ts`: `checkConfig()` splits malformed values and unknown keys (structural `CONFIG_INVALID`) from missing values that have no default (readiness `CONFIG_REQUIRED`). `resolveConfig()` applies defaults.
  - `operations.ts`: 12 op types (`addElement`, `updateElement`, `removeElement`, `addAttachment`, `updateAttachment`, `removeAttachment`, `connect`, `disconnect`, `setNotes`, `addAnnotation`, `updateAnnotation`, `removeAnnotation`), `operationBatchSchema` (`{ baseRevision, ops }`, 1–500 ops), and `operationBatchJsonSchema()`.
  - `validate.ts`: `validateDesign(doc, lookup)` returns every finding in document order. Also `resolveEndpoint()` and `portIncompatibility()`, which the registry reuses.
  - `apply.ts`: `applyOperations(doc, ops, lookup, { baseRevision? })` returns `{ ok: true, design, findings }` with revision + 1, or `{ ok: false, errors }`. It never mutates its input.
- **`packages/registry`**: `createRegistry(manifests)` validates the manifest set and throws `RegistryError` on any of these:
  - a bad manifest, or the same ID and version registered twice
  - two ports with the same kind and direction
  - a card chip or preset that doesn't match the config
  - a config schema that can't be exported as JSON Schema
  - a slot pointing at a template that isn't a registered attachment

  The registry provides `list`, `latest`, `get`, `versions`, `describe` (serializable, with `configJsonSchema`), `palette()` (grouped Services / Frontends / Data / Libraries / External), `attachmentsFor`, `canAttach`, `canConnect` (with `suggestions`: use an existing attachment, or add one), and `connectionKinds`. `builtinRegistry()` loads the five v1 manifests.
- **`templates/{http-service,rest-api-server,postgres,web-app,rest-api-client}/manifest.ts`**: manifest-only packages `@jeeves/template-<id>` at 0.1.0, with config taken from the briefs.
- **`fixtures/designs/`**: `link-shortener.json` + `.layout.json` (valid; it's the S10 "service + REST server + Postgres + web app + client" fixture), `incomplete.json` (readiness findings only), `invalid.json` (structural problems), and a README with the expected findings.

### Rules worth knowing

- **Ports are found by (kind, direction)**, so connections don't name ports and a manifest can't have two ports with the same pair. `accepts` on either end can restrict the other end by template ID or element kind. Ports in v1:
  - `http-service`: out `uses-database` (database elements only), out and in `depends-on`
  - `postgres`: in `uses-database` (services and workers)
  - `web-app`: out `depends-on`
  - `rest-api-server`: in `calls` (from `rest-api-client` only)
  - `rest-api-client`: out `calls`, **required**, **single**, to `rest-api-server` only
- **Attachment compatibility lives on the element** (`attachmentSlots`, optional `max`). `http-service` takes one `rest-api-server` and any number of `rest-api-client`s. `web-app` takes `rest-api-client`s.
- **Rejecting a batch:** ops apply in order on a copy. A missing ID or ID collision fails immediately with `target.op` set. Then the result is validated. The batch is rejected only if it introduces a structural finding the input didn't already have (compared by code and target), so a design left broken by a registry change can still be edited and fixed. Readiness findings never reject.
- **Cascades:** `removeElement` and `removeAttachment` delete their connections, and removing anything unbinds arrows that pointed at it. Changing a template that strands attachments is rejected (`ATTACHMENT_INCOMPATIBLE`), not cascaded.
- **`updateElement` / `updateAttachment` `config` replaces the whole stored config.** Stored config holds only user-set values; defaults are applied by `resolveConfig`.
- **Finding codes:**
  - structural: `DUPLICATE_ID`, `UNKNOWN_REFERENCE`, `UNKNOWN_TEMPLATE`, `TEMPLATE_KIND_MISMATCH`, `CONFIG_INVALID`, `ATTACHMENT_INCOMPATIBLE`, `PORT_INCOMPATIBLE`, `PORT_MULTIPLICITY`, `DUPLICATE_CONNECTION`
  - readiness: `NEEDS_TEMPLATE`, `CONFIG_REQUIRED`, `UNCONNECTED_REQUIRED_PORT`
  - operation: `INVALID_OPERATION`, `REVISION_CONFLICT`

  All of them are error severity for now. `blocksGenerate` already supports warnings when one is needed.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 90 files in 16ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all 12 workspace packages: Done)
$ vitest run
 Test Files  8 passed (8)
      Tests  96 passed (96)
```

Coverage of the "Done when" checks:

- **Every op type:** `packages/spec/src/apply.test.ts` has `opCases: Record<OperationType, …>`, so a new op without a test is a type error.
- **All-or-nothing batches:** a later missing reference, a structurally invalid result, a malformed op at index 1, and an empty batch each reject the whole batch, and the input stays unchanged.
- **Each finding code:** `validate.test.ts` has `cases: Record<FindingCode, …>`, with one or more cases per code that check the code, severity, and target.
- **Fixtures:** `packages/registry/src/fixtures.test.ts` checks the exact findings for each fixture. It also rebuilds link-shortener from an empty design in one batch and fixes `incomplete.json` to zero findings through ops.
- **JSON Schema export:** `schemas.test.ts` checks that `operationBatchJsonSchema()` contains all 12 op variants and survives a JSON round trip. `registry.describe()` exports config JSON Schema (`io: "input"`, so fields with defaults aren't required).

No e2e tests changed; S2 has no UI.

### Deviations and choices the plan left open

- `applyOperations` takes `baseRevision` in an options argument rather than inside `ops`. That keeps the plan's `(doc, ops, registry)` signature, and `operationBatchSchema` is the HTTP body shape for S3.
- Added codes beyond the plan's examples (listed above) so every rejection has a specific, stable code.
- `web-app.title` has no default, so it's required (a `CONFIG_REQUIRED` finding until set). `postgres.version` is `"17"` only, which S7 may widen. Postgres `logicalDatabases` isn't config; it's derived from incoming connections, as the brief says.
- `canConnect` and `canAttach` work by validating a copy with a probe item, so the canvas can never disagree with `applyOperations`.
- Spec tests use small inline manifests (`src/test-support.ts`, not exported) so `@jeeves/spec` doesn't depend on the template packages, which depend on it.

### Known issues

- Biome sometimes needs `pnpm format` twice on long chained Zod expressions before `pnpm lint` is clean.

### For S3

- Store the design as JSON validated with `designSchema` and layout with `layoutSchema`. Use `operationBatchSchema` for `POST /projects/:id/operations`, `applyOperations(current, batch.ops, builtinRegistry(), { baseRevision: batch.baseRevision })`, and map `REVISION_CONFLICT` to 409 with the current document. Other errors are 422-style with the `errors` array.
- Undo and redo apply stored snapshots directly (not through ops), but still bump `revision` and should re-run `validateDesign` to refresh findings.
- `registry.describe(ref)` and `registry.palette()` are ready for the registry list/describe routes. `pruneLayout` is there for when layout outlives removed items.

---

## S3: Design API (2026-10-28)

### Built

- **Drizzle tables** (`apps/server/src/db/schema.ts`, migration `apps/server/drizzle/0000_design_api.sql`):
  - `projects`: uuid `id`, `name`, current `revision`, timestamps.
  - `design_revisions`: one row per (project, revision) with the design `document` and the `findings` saved alongside it.
  - `operations`: the history. `kind` is `edit | undo | redo`. `source` is `canvas | chat | api`. Edits keep the batch as posted in `ops` and have a `state`: `applied | undone | discarded`. Undo and redo rows point at their edit through `target_id`. Every row stores the `before` and `after` documents plus `base_revision` and `revision`.
  - `layouts`: one layout document per project.
- **Migrations run on server start** (`connectDb().migrate()` in `main.ts`). This is a local, single-user app, so there's no separate migrate step to forget.
- **`DesignService`** (`src/design/service.ts`): every change runs in one transaction that takes `SELECT … FOR UPDATE` on the project row, so edits to one project are serialized. It calls `applyOperations` and `validateDesign` from `@jeeves/spec` with the builtin registry.
- **Routes** (no `/api` prefix; the Vite proxy strips it). Bodies and params are validated with `fastify-type-provider-zod`. Errors use `{ code, message, … }`.

  | Route | Result |
  | --- | --- |
  | `GET /projects`, `POST /projects {name}` (201), `GET/PATCH/DELETE /projects/:id` | `{ projects }` / `{ project }`; DELETE is 204 and cascades |
  | `GET /projects/:id/design` | `DesignState`: `{ projectId, design, findings, history: { canUndo, canRedo } }` |
  | `GET /projects/:id/findings` | `{ revision, findings }` (as saved) |
  | `POST /projects/:id/operations {baseRevision, ops, source?}` | 200 `DesignState & { operationId }`; 409 `REVISION_CONFLICT` with the current `DesignState`; 422 `INVALID_OPERATION` with `errors: Finding[]` |
  | `POST /projects/:id/undo`, `/redo` `{baseRevision, source?}` | same as operations; 422 `NOTHING_TO_UNDO` / `NOTHING_TO_REDO` |
  | `GET/PUT /projects/:id/layout` | `{ layout }`; PUT takes a `layoutSchema` body |
  | `GET /templates` | `{ templates: TemplateDescription[], palette: [{ group, templates: [{id, version}] }] }` |
  | `GET /templates/:id`, `/templates/:id/:version` | `{ template }` (latest or exact) |

  Other errors: 400 `BAD_REQUEST` with `issues` for schema failures (including a non-uuid project ID and an empty `ops`), and 404 `NOT_FOUND`.

### How undo and redo work

- History is linear. **Undo** takes the newest `applied` edit, restores its `before` snapshot as revision + 1, and marks it `undone`. **Redo** takes the oldest `undone` edit, restores its `after`, and marks it `applied`. **A new edit** marks every `undone` edit `discarded`. So undone edits are always the newest ones, and "oldest undone" is the right redo target.
- Undo and redo need `baseRevision` and return 409 if it's stale, the same as edits. They re-run `validateDesign` on the restored snapshot instead of trusting stored findings, because the registry may have changed.
- Undo and redo are recorded as their own `operations` rows, so the table is a complete audit trail.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 98 files in 18ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  10 passed (10)
      Tests  110 passed (110)
```

`pnpm test:e2e` (unchanged shell test, now with a server that migrates on start):

```text
  ✓  1 [chromium] › apps/web/e2e/shell.spec.ts:4:1 › loads the shell, reports a healthy server, and switches views (1.2s)
  1 passed (3.0s)
```

Manual smoke test against Docker Postgres (`pnpm db:up`, then `pnpm start` in `apps/server` on port 4319): `/health` was ok, and the migration applied on start. Create project → edit (revision 1) → stale edit 409 → undo (revision 2, `canRedo: true`) → delete 204.

Coverage of the "Done when" checks (`apps/server/src/routes/projects.test.ts`):

- **Save/reload:** the link-shortener fixture is built in one batch and reloads equal to the fixture at revision 1.
- **Stale `baseRevision`:** returns 409 `REVISION_CONFLICT` with the current document (revision 2, both elements) and history. The design is unchanged. Undo and redo with a stale base also return 409.
- **Invalid batch changes nothing:**
  - a missing reference at op 1 (`UNKNOWN_REFERENCE`, `target.op = 1`)
  - a malformed op (`INVALID_OPERATION` at index 1)
  - a structurally invalid result (`ATTACHMENT_INCOMPATIBLE`)
  - an empty `ops` (400)

  After all four, the design state is identical and the only undo step is still the first edit.
- **Undo/redo across server restarts:** PGlite with an on-disk data directory, closed and reopened twice (after the edits, and between undo and redo). The test covers undo to empty, `NOTHING_TO_UNDO`, redo, and a new edit discarding the redo chain (`NOTHING_TO_REDO`).
- **Layout writes don't change the semantic revision:** two PUTs leave the project and design at revision 1 with the same history. A malformed layout gets 400 and nothing is stored.
- Also covered: project CRUD and cascade delete, readiness findings saved and served (`CONFIG_REQUIRED`), a whole batch as one undo step, and the template list/describe/404 routes.

### Deviations and choices the plan left open

- **API tests use PGlite** (`@electric-sql/pglite` 0.5.9, dev dependency), an in-process WASM Postgres, through `drizzle-orm/pglite` and the same migration files. That satisfies "unit tests must not need Docker" while still testing real SQL, `FOR UPDATE`, and jsonb. `src/test-support.ts` provides `openTestDb(dir?)` and `buildTestApp(db)`. The shared `Db` type is `PgDatabase<PgQueryResultHKT, typeof schema>`, so services work with either driver.
- **`buildApp` now requires `db`.** Tests that don't touch the database (health, templates) pass `{} as Db`.
- **`ops` is validated loosely at the HTTP layer** (`z.array(z.unknown())`), so `applyOperations` reports malformed ops as `INVALID_OPERATION` findings with their op index instead of a generic 400. `baseRevision` and the batch size are still schema-checked.
- **Added `source`** (`canvas | chat | api`, default `api`) to the operations and undo/redo bodies, plus `operationId` in responses, so S6 can label chat turns. There's no history-list route yet; add `GET /projects/:id/operations` if S5 or S6 needs one.
- **The stale-base check happens before op validation:** a stale and malformed batch gets 409, not 422.
- `fastify-type-provider-zod` 7.0.0 needs `@fastify/swagger` and `openapi-types` as peers, so they're installed (9.9.0 and 12.1.3). Swagger isn't registered.
- `PUT /layout` stores what it's given (schema-validated). It doesn't check IDs against the design and doesn't prune. Layout entries for items removed by an edit are kept on purpose, so an undo brings the item back at its old position.

### Known issues

- Postgres `jsonb` doesn't keep key order. Designs come back with keys in a different order than they were written (deep-equal, not byte-equal). **S10:** serialize `jeeves/design.json` canonically (sorted keys) so generation stays deterministic.
- The server's `/health` and every other route share one process. If Postgres is down at startup, `main.ts` fails on `migrate()` instead of starting degraded. That's acceptable for `pnpm dev`, which waits for Postgres first.
- The first PGlite open in a test file takes about 0.5 s (WASM init). The restart test opens it three times.

### For S4

- Load the board with `GET /api/projects/:id/design` and `GET /api/projects/:id/layout`, and the palette with `GET /api/templates` (`palette` groups reference `templates` by ID and version).
- Send canvas edits with `source: "canvas"` and the `baseRevision` you last saw. On 409, the body already has the current `DesignState`. On 422, show `errors[0].message`. Use `registry.canConnect` logic client-side for refusal explanations before posting, since the server's answer is a generic 422.
- Layout is last-write-wins with no revision. Debounce PUTs and send the whole document.
- There's no projects UI yet. S4 needs at least "create or open a project" (e.g. auto-create one on first load).

---

## S4: Draw Jeeves canvas, part 1 (board) (2026-10-28)

### Built

All new code is in `apps/web/src/draw/`. New web dependencies: `@xyflow/react` 12.11.6 and `zustand` 5.0.15 (automation-pitch's versions), plus `@jeeves/spec` and `@jeeves/registry` from the workspace.

- **`store.ts`** (Zustand) holds the open project, the design/findings/history from the server, the layout, the template catalog, the current tool, the connector's first click, the notice strip, and which annotation is being edited.
  - `edit(ops)` posts to `/operations` with `source: "canvas"` and the last seen revision. Edits are chained so they post one at a time. The store always adopts the design the server returns.
  - On a 409 it adopts the current design from the response and says "The design changed somewhere else…". On a 422 it shows `errors[0].message`.
  - `setLayoutItems` / `setViewport` change the layout locally and save it with a PUT debounced by 400 ms. `flushLayout()` runs on `pagehide` and on unmount.
- **Projects:** the project comes from `?project=<id>` in the URL, else the last one opened (localStorage `jeeves.project`), else the newest, else a new "Untitled design". The ID is written back to the URL. The header has a project menu (switch projects, New project). There's no rename or delete UI yet.
- **`flow.ts`** maps the design and layout to React Flow nodes and edges. It's pure and keeps React Flow's `measured` and `selected` across rebuilds.
  - Nodes: elements, plus text, note, and frame annotations. Frames have `zIndex: -1`.
  - Edges: connections, plus arrows bound at both ends. Arrows with a free end are drawn from layout `points` by `edges/FreeArrows.tsx`.
  - Items with no layout entry go on a 4-column fallback grid.
  - Handle IDs: an element's own ports are `in` / `out`; an attachment mini-box's are `in:<attachmentId>` / `out:<attachmentId>`.
- **Toolbar** (`Toolbar.tsx`, floating, Excalidraw-style): Select, Hand, Elements palette, Attachments palette, Connector, Text, Sticky note, Frame, and Delete selection.
  - The element palette is grouped from `GET /templates` `palette`. The attachment palette lists the latest attachment templates.
  - Click-to-place: pick a tool, then click the board. Picking an attachment, then clicking a card, attaches it.
  - Drag-to-place: palette items and the Text/Note/Frame buttons are HTML5-draggable onto the board. Attachments are dropped onto a card; the drop is hit-tested by point.
  - Optional shortcuts: V, H, C, T, N, F, Escape, Delete/Backspace.
  - After placing anything, the tool goes back to Select.
- **Element card** (`nodes/ElementNode.tsx`): template icon, name, template name, the manifest's chips (stored value, else the JSON Schema default, else a red dashed "not set"), and the attachment mini-boxes. Each mini-box has its own handles, a compact chip, and a remove (×) button while the card is selected.
- **Connections** (`connect.ts`, `planConnect`) work by dragging handle to handle, or with the Connector tool (click an item, then another; clicking a mini-box picks that attachment).
  - The connection kind is inferred with `registry.connectionKinds`. If more than one kind fits, the notice asks which.
  - A refusal shows the reason with one-click fixes:
    - the reverse direction ("can't start a … connection; it goes the other way" plus "Connect from … instead")
    - use an existing attachment
    - add an attachment and connect it
  - A connection with an annotation at either end becomes a plain arrow annotation.
  - The checks run client-side with `builtinRegistry()` from `@jeeves/registry`, the same code the server uses.
- **Annotations** (`nodes/AnnotationNodes.tsx`): double-click to edit text in place. The edit is saved as one `updateAnnotation` on blur; Escape cancels and Ctrl/Cmd+Enter commits. New text and notes open in edit mode. Notes and frames resize with React Flow's `NodeResizer`, which saves width and height to the layout.
- **Board:** the paper texture follows the camera, React Flow `Controls` give mouse zoom and fit, the Hand tool pans with automation-pitch's grab cursors, and the middle or right button pans in any tool.
  - The camera saves to `layout.viewport` on move end. If there's no saved camera, the board fits once on open, but only when it isn't empty.
- **Unit tests:** `src/test-api.ts` is an in-memory fake of the design API built on the real `applyOperations` and `validateDesign`. It's used by `App.test.tsx` and `store.test.ts`.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 119 files in 25ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  13 passed (13)
      Tests  128 passed (128)
```

`pnpm test:e2e`:

```text
  ✓  2 [chromium] › apps/web/e2e/shell.spec.ts:4:1 › loads the shell, reports a healthy server, and switches views (1.7s)
  ✓  1 [chromium] › apps/web/e2e/draw.spec.ts:89:1 › refuses an incompatible connection with an explanation (2.0s)
  ✓  3 [chromium] › apps/web/e2e/draw.spec.ts:121:1 › dragging a node saves layout without changing the semantic revision (2.7s)
  ✓  4 [chromium] › apps/web/e2e/draw.spec.ts:33:1 › builds a service + REST server + Postgres board that survives a reload (3.2s)
  4 passed (5.1s)
```

`npx playwright test --repeat-each 4` gave 16 passed (no flakes). `vite build` succeeds; it warns that the bundle is over 500 kB.

Coverage of the "Done when" checks (`apps/web/e2e/draw.spec.ts`, one fresh project per test):

- **Place, attach, connect, reload:** the test places a service by click, drags the REST API server onto its card, drags Postgres onto the board, and connects service → Postgres with the Connector tool. The API then shows two elements, one attachment, and one `uses-database` connection. After a reload the cards, mini-box, and connection chip are back, with the same node transform. Axe reports zero violations on the board.
- **Incompatible connection refused:** Postgres → service shows an alert (`"PostgreSQL" can't start a "uses-database" connection …`). No edge is drawn and the revision doesn't change. Clicking the suggested fix connects it the right way round (revision + 1).
- **Dragging doesn't change the revision:** a mouse drag of a card triggers a layout PUT and moves the saved position, and the semantic revision stays the same.

I also checked by hand, in screenshots: the link-shortener fixture with a frame, text, and note in light and dark mode; a handle-to-handle drag (web app → service made a `depends-on`); and editing a note in place.

### Deviations and choices the plan left open

- **Palette from the API, compatibility from the bundled registry.** The palette and card data come from `GET /templates`, as the plan says. Connect and attach checks import `builtinRegistry()` in the browser, because they need the Zod manifests and must agree with the server exactly. If templates ever load dynamically on the server, this needs an API check (e.g. a `POST /projects/:id/can-connect`).
- **The connection kind is inferred, not picked.** With the v1 manifests, at most one kind ever fits a pair of ends. The chooser in the notice exists but isn't reached by any v1 pair.
- **Plain arrows are drawn by connecting to or from an annotation.** Arrows with a free end can't be created from the canvas yet (§5 lists "plain arrow" under annotations). They're rendered if chat or the API makes them and the layout has `points`, but they can't be selected or edited.
- **Frames don't contain anything.** Layout `parent` isn't set, and moving a frame doesn't move what's on it.
- **Some minimal deletion is included** even though S5 owns multi-select delete. The Delete button and key remove the current selection (rubber-band selection already gives multi-select), and the × on a selected card's mini-box removes that attachment. Without them, S4's board couldn't undo a mistake by mouse.
- **Element IDs are slugs of the display name** (`http-service`, `http-service-2`, …) and names get " 2" suffixes. S5's inspector will let users rename; IDs never change.
- The React Flow attribution is hidden (`proOptions.hideAttribution`). React Flow logs a console warning about it; that's harmless.

### Known issues

- There's no client-side layout undo yet (§6); S5 adds undo/redo.
- If a placement edit fails, its layout entry stays behind as an orphan. That's harmless; `pruneLayout` exists if it matters.
- Setting `pointer-events: none` on the palette while dragging cancels the HTML5 drag in Chromium, so the palette only fades. On a short window the palette can cover cards under the toolbar; drag-to-attach then needs the card lower, or use click-to-attach.
- The bundle is about 1 MB minified (Mantine, React Flow, Zod, and the registry). Code-split later if it matters.

### For S5

- Selection lives in React Flow's node and edge state inside `Canvas.tsx`, not in the store. The inspector will need it in the store: mirror `selected` in `onNodesChange` / `onEdgesChange`.
- `useDraw.getState().edit(ops)` is the single write path. `loaded.history` (`canUndo` / `canRedo`) is already kept up to date, so undo/redo buttons only need `POST /undo` and `/redo` plus adopting the returned state, the same as `edit`.
- `loaded.findings` is loaded and refreshed on every edit but not shown yet. Put the badges in `ElementNode`, next to `.element-card-head`.
- Cards are `<article aria-label="<name>, <template>">` and mini-boxes are `<li aria-label="<template>">`. The e2e tests depend on those names.
- `apps/web/e2e/draw.spec.ts` has the helpers `openNewProject`, `designOf`, and `layoutOf`.

---

## S5: Draw Jeeves canvas, part 2 (inspector, findings, history) (2026-10-28)

### Built

All in `apps/web`. No new dependencies.

- **Rail** (`src/draw/inspector/Rail.tsx`): a 360 px panel on the right of the Draw view with **Inspector** and **Findings** tabs. The Findings tab shows a count (red, or green at 0). The rail collapses to a 48 px strip that keeps an expand button and the findings count; the choice is stored in localStorage (`jeeves.rail`). `DrawView` is now a flex row, `.draw-main` (board, notice, hints) and the rail, rather than Mantine `AppShell`, because only the Draw view needs a rail.
- **Inspector** (`inspector/Inspector.tsx`) follows the board selection:
  - **Element:** template header, Name, a template picker (shown only for "needs a template" elements), findings that aren't tied to a field, Configuration, Implementation notes, Attachments, Connections, and Delete. Each attachment has its own config form, notes, and remove button. There's an "Add attachment" menu built from `registry.attachmentsFor`. Each connection row shows the kind and the other end; clicking the other end selects it and zooms to it, and × disconnects.
  - **Connection:** kind, From and To (click to focus), findings, and Delete.
  - **Annotation:** text (text and note), color swatches (note), title (frame), label (arrow), and Delete.
  - **Several items:** "N items selected", Zoom to selection, and Delete N items (one batch, so one undo step).
  - **Nothing selected:** project name, counts, and a button that shows the findings.
- **Config form** (`inspector/ConfigForm.tsx`, `configFields.ts`) is built from the template's `configJsonSchema` with Mantine inputs. No form library: the v1 configs are flat objects of scalars, and the JSON-Schema form libraries don't fit Mantine cleanly. Field types:
  - integer and number: `NumberInput` with stepper buttons and `clampBehavior="none"`
  - string enum: `NativeSelect`, with the default marked "(default)"
  - string: `TextInput`
  - boolean: `Switch`
  - anything else: a JSON textarea
- **How fields behave:**
  - A field shows the effective value (stored, else the default), so steppers and selects start from what the template would use.
  - A ↺ button beside a field resets a stored value back to the default.
  - A no-op commit (no change, or setting the default on an unset key) sends nothing.
  - A value is checked with the template's Zod schema (`checkConfig`, the same function the server uses) before it's sent. A malformed value shows the error at the field and isn't posted.
  - `CONFIG_REQUIRED` and `CONFIG_INVALID` findings show at their field (matched by `target.path[0]`); "Required" is shown for the former.
- **Draft fields** (`inspector/fields.tsx`): text, number, and notes fields keep a local draft and commit once, **on blur**. Enter also commits single-line fields, and Ctrl/Cmd+Enter commits textareas. Escape reverts. So one finished field edit is one operation and one undo step, and clicking anywhere else commits by mouse. Drafts follow the stored value when it changes underneath (undo, another tab, chat later).
- **Findings:**
  - `src/draw/findings.ts` places each finding: element and attachment findings go to the element's card, and connection findings go to the edge. The store keeps `loaded.findingIndex` up to date on every adopt.
  - Cards show a red badge (`role="img"`, "N findings") with the messages in its tooltip.
  - Clicking a finding in the Findings tab selects its card or edge, zooms to it, and switches to the Inspector, where the field is marked.
- **Undo/redo** (`store.ts`):
  - Undo and Redo buttons at the end of the toolbar. Shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y. The shortcuts are ignored while typing, so text fields keep their native undo.
  - Design steps call `POST /undo` and `/redo` (`api.undo` / `api.redo`; `api.edit` now shares the same `change()` helper).
  - Moves and resizes are undone locally (PLAN §6: "Layout has its own client-side undo"). One local stack (`undoSteps` / `redoSteps`) records `design` markers and `layout` steps (before/after items), so undo always reverses whatever happened last. A new edit or move clears redo, the same as the server does.
  - If the stack is empty (e.g. after a reload), the buttons still follow the server's `canUndo` / `canRedo`. Stale design markers (e.g. undone in another tab) are skipped.
  - `setLayoutItems(items, { undoable: true })` is what records a step. Drag stop and note/frame resize pass it. Placement doesn't, because the `addElement` undo covers it.
- **Selection** is mirrored into the store (`selection`, from React Flow's `onSelectionChange`). `focus(selection, { zoom })` posts a `focusRequest` that the canvas applies, setting the nodes' and edges' `selected` flags and running `fitView` on them. **Zoom to selection** is also a button in the zoom controls, and Shift+2.
- **Conflicts:** edits, undo, and redo share one `settle()`. On a 409 it adopts the server's current design and says "The design changed somewhere else, so the board was reloaded with the latest version. Try that again."
- **Theme:** Mantine's error color is mapped to `--minus` on `body`, and the light `--minus` is slightly darker (`#b23a30`). Both changes are for axe contrast: Mantine's default red was 3.2:1 on cream, and S4's "not set" chip was 4.4:1 on paper. Rail inputs use the paper/ink tokens, so dark mode stays blue-steel.
- Small refactor: `src/draw/registry.ts` holds the single browser-side `builtinRegistry()` instance, now shared by the canvas and the inspector. The e2e helpers moved from `draw.spec.ts` to `e2e/helpers.ts`.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 132 files in 30ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  16 passed (16)
      Tests  144 passed (144)
```

`pnpm test:e2e`:

```text
  ✓  1 [chromium] › apps/web/e2e/draw.spec.ts:61:1 › refuses an incompatible connection with an explanation (2.4s)
  ✓  3 [chromium] › apps/web/e2e/inspector.spec.ts:120:1 › refuses a malformed value at the field and edits attachment config (3.0s)
  ✓  4 [chromium] › apps/web/e2e/draw.spec.ts:93:1 › dragging a node saves layout without changing the semantic revision (3.0s)
  ✓  7 [chromium] › apps/web/e2e/inspector.spec.ts:222:1 › reloads the design and says so when another edit got there first (1.5s)
  ✓  2 [chromium] › apps/web/e2e/draw.spec.ts:5:1 › builds a service + REST server + Postgres board that survives a reload (4.0s)
  ✓  5 [chromium] › apps/web/e2e/inspector.spec.ts:169:1 › deletes a multi-selection, zooms to it, and undoes moves (4.2s)
  ✓  8 [chromium] › apps/web/e2e/shell.spec.ts:4:1 › loads the shell, reports a healthy server, and switches views (1.5s)
  ✓  6 [chromium] › apps/web/e2e/inspector.spec.ts:31:1 › edits config and notes, sees findings appear and clear, and undoes and redoes (4.8s)
  8 passed (7.8s)
```

`npx playwright test --repeat-each 3`, run five times: 24 passed each time, so 120 runs with no failures. That was after making the axe helper wait for toolbar tooltips to close (see known issues). I also checked screenshots of the link-shortener fixture by eye: the inspector in light and dark mode, and the Findings tab.

Coverage of the "Done when" checks (`apps/web/e2e/inspector.spec.ts`). Every action is a mouse click; text is typed, then committed by clicking elsewhere:

- **Config and notes edits, findings appearing and clearing:**
  - A new web app shows "1 finding" on its card and in the Findings tab.
  - Clicking the finding selects the card and opens the inspector with "Required" at Title.
  - Typing a title and clicking away clears the badge, the count, and the field error.
  - The Port stepper button changes 5173 to 5174, and the Notes field saves.
  - The API confirms each value.
- **Undo and redo:** three Undo clicks revert notes, port, and title, and the finding comes back. Three Redo clicks restore all three, and Redo is then disabled. The API revisions and documents are checked at each end.
- **Also covered:**
  - an enum select, reset to default, and an out-of-range port that shows the Zod message at the field and posts nothing
  - adding an attachment from the inspector and editing its config
  - undoing a drag (the saved layout goes back and the revision doesn't change)
  - rubber-band selection, Zoom to selection, Delete 2 items, and undoing that delete as one step
  - the 409 path: a rename via the API, then an edit in the inspector, shows the notice, and the board and field show the other edit
- **axe:** zero violations on the Draw view with an element open in the inspector, and again on the Findings tab at the end.

Unit tests:

- `store.test.ts`: server undo/redo, interleaved layout and design steps, redo dropped after a new edit, a 409 on undo, and the findings index and focus requests.
- `findings.test.ts`
- `inspector/configFields.test.ts`: fields from the real manifests, parsing, the JSON fallback, and Zod errors per key.
- `inspector/Inspector.test.tsx`: renders the rail with the fake API. It covers commit on blur, a refused out-of-range value, and selection from the findings list.
- `test-api.ts` now implements undo/redo, and `vitest.setup.ts` stubs `document.fonts` for Mantine's autosizing Textarea.

### Deviations and choices the plan left open

- **No form library**, as described above. If a later template needs nested objects or arrays, extend `configFields` rather than relying on the JSON textarea.
- **The notes editor is a plain Markdown textarea** with no preview. A preview needs a Markdown renderer dependency. Add one if users ask.
- **The findings panel is a tab in the rail**, not a separate floating panel, and clicking a finding switches to the Inspector. That way the field to fix is right there. The tab's count is always visible, also in the collapsed rail.
- **Layout undo is local and lives in the same stack as design undo** (see above). Undo history isn't persisted across reloads for layout; design undo is, because it's the server's.
- **"Reload" on a conflict** adopts the design from the 409 body, which is the current design. Layout isn't refetched, because local layout may have unsaved changes and layout is last-write-wins anyway.
- The inspector doesn't let you change an existing element's template (only "needs a template" elements get a picker), since a template change that strands attachments is rejected anyway.

### Known issues

- Mantine `Tooltip`s render in a portal outside any landmark, so axe's `region` rule flags one if it's open during a scan. The e2e helper moves the mouse away and waits for none to be open.
- Items with no layout entry still go on S4's fallback grid at the origin, and can overlap fixture-positioned cards (e.g. an element added by the API to a board with a saved layout). S6's ELK auto-placement should fix this for chat-created elements.
- Undo while an edit is still in flight checks `canUndo` before that edit returns. In practice the edit chain serializes the requests, so the worst case is a no-op click.
- Plain arrows with free ends are still not selectable (from S4), so they can't be inspected.

### For S6

- Chat edits should go through the same server operations with `source: "chat"`. The board picks them up when the client adopts a new `DesignState`. The canvas only learns about other writers on its next edit (409) or a reload, so after a chat turn, call `useDraw`'s adopt path with the returned state. Exposing `adopt` from the store (it's internal now) is the simplest way.
- To highlight changed elements after a turn, use `useDraw.getState().focus({ nodes: changedIds }, { zoom: true })`.
- A per-turn Undo button can call `useDraw.getState().undo()` when the chat turn is the newest server step. Otherwise it needs a targeted undo the server doesn't have yet (it only undoes the newest applied edit).
- The rail is a natural home for the chat panel, as a third tab or a docked section. `Rail.tsx` is small.

---

## S6: Providers and design chat (2026-10-29)

### Built

New dependencies, pinned: `openai` 7.34.0 (providers), `@resvg/resvg-js` 2.6.2 and `elkjs` 0.12.0 (server, elkjs matches automation-pitch).

- **`packages/providers`**
  - `types.ts`: a provider-neutral `ModelProvider` interface with `respond(request, { signal, onEvent })`.
    - Requests and responses carry a list of `ModelItem`s: messages (text and image parts), tool calls, tool results, and `opaque` items (provider state that must be replayed).
    - Each provider declares `capabilities`, and `assertSupported` throws an `unsupported` `ProviderError` rather than silently dropping an image or tools.
    - `ModelRole` is `designChat | planner | coding`.
  - `errors.ts`: `ProviderError` with a `kind` of `auth | quota | rate-limit | unavailable | bad-request | unsupported | other`. `blocksProvider` is true for auth and quota (the §10 `waiting_for_provider` rule for S11/S12).
  - `openai.ts`: the Responses API adapter.
    - Streamed, stateless (`store: false`), and resends the whole conversation each call.
    - Reasoning items come back encrypted (`include: ["reasoning.encrypted_content"]`) and are replayed as opaque items within a turn.
    - Tools use `strict: false`, because the operation schemas have optional fields.
    - SDK errors are mapped to `ProviderError` kinds (401/403 → auth, 429 `insufficient_quota` → quota, other 429 → rate-limit, 5xx/network → unavailable).
  - `fake.ts`: `createFakeProvider(script)` replays steps (text, tool calls, usage, or a scripted error), streams text word by word, and records every request.
    - `scriptByMessage(json)` is a stateless script keyed by the person's latest message, plus how many model rounds have run since it. The e2e server uses it, since many projects share one process.
    - Messages starting with `CALLER_NOTE_PREFIX` (`[Jeeves]`) don't start a new turn.
- **Server chat** (`apps/server/src/chat/`)
  - `service.ts` `ChatService` runs a turn:
    - It inserts a `running` turn, then calls the model with the §7 tools until a response has no tool calls or the model calls `askUser`. At most 16 rounds.
    - It commits every edit as **one** `source: "chat"` operation through `DesignService.edit`, so a turn is one undo step.
    - It places new items, then saves the turn.
    - One turn per project at a time; a second gets 409 `CHAT_BUSY`.
    - A failed turn (provider error, no key, too many rounds) commits nothing and stores the error.
  - **Stale edits:**
    - If the commit gets a 409, the pending ops are replayed on the current design and committed (up to three times).
    - If they no longer apply, nothing is committed. The workspace resets to the current design and the model gets a `[Jeeves] Your edits were not applied … Call getDesign …` note, then redoes its edits (at most two redos per turn).
  - `tools.ts` has a `Workspace`, a working copy of the design, plus the tools: `listTemplates`, `describeTemplate`, `getDesign`, `applyOperations`, `validateDesign`, `explainFinding`, and `askUser`.
    - `applyOperations` checks each batch with the real `applyOperations`. That's what enforces "never invent template IDs or config keys" (`UNKNOWN_TEMPLATE` / `CONFIG_INVALID` refusals go back to the model).
    - Each tool call adds an activity line ("Prepared 5 changes", "Edit refused: …").
  - `context.ts`: the system instructions (the §7 rules), a one-line-per-template catalog, a design summary, and the selection. These go in a `[Jeeves] Context` user message before the person's message. Earlier turns (the last 12) are sent as plain user/assistant messages, with any question asked and any failure noted.
  - `files.ts` handles uploads:
    - accepted types: Markdown, text, PNG, JPEG, WebP, and SVG, up to 10 MB
    - checked by magic bytes or UTF-8 decoding; an SVG must render
    - text is sent as text, cut at 60k characters
    - images are sent as image parts
    - SVG is rasterized with resvg (512–1600 px wide, white background), and its source is added when it's under 20k characters
  - `place.ts`: ELK (layered, left to right) lays out the new items among themselves. The block goes to the right of the selection, or of everything if nothing is selected, and is moved down until it overlaps nothing. Existing items never move. Card sizes are estimates (element 260 × 110 + 34 per attachment).
  - `models.ts`: `providerModels(settings)` re-reads the OpenAI key on every turn. `fakeModels(path)` is used when `JEEVES_FAKE_MODEL_SCRIPT` is set.
- **Tables** (migration `0001_chat.sql`):
  - `files` (bytea data, cascade on project delete)
  - `chat_turns` (message, file IDs, selection, status, reply, question, `operation_id`, changed IDs, activity, usage, model, error)
  - `main.ts` marks turns left `running` as failed at startup.
- **Routes:**

  | Route | Result |
  | --- | --- |
  | `GET /projects/:id/chat` | `{ turns }` |
  | `POST /projects/:id/chat {message, fileIds?, selection?}` | NDJSON stream of `turn`, `text`, `activity`, then `done` with `{ turn, state, layout }`. 404, 409 `CHAT_BUSY`, and 422 `UNKNOWN_FILE` are plain JSON before streaming |
  | `POST /projects/:id/files` | Raw body with the file's content type and an `x-file-name` header (URI-encoded); 201 `{ file }`, 415 unsupported, 422 invalid |
  | `GET /projects/:id/files/:fileId` | The bytes, with a sandboxing CSP |
  | `GET /settings`, `PUT /settings/models` | Key status (never the key), the config path, models per role, and `fakeModel` |

- **Settings** (`src/settings.ts`): the OpenAI key comes from `OPENAI_API_KEY`, else `~/.jeeves/config.json` `openai.apiKey`. `JEEVES_HOME` moves the directory. Models per role are stored in the same file, which is written with mode 600 and keeps other keys. Default models: `designChat` and `planner` `gpt-5.4-mini`, `coding` `gpt-5.1-codex`. These are guesses from the SDK's model list; change them in Settings.
- **`DesignState.history.latestEdit`**: the operation ID the next undo would revert, or `null`. The chat's per-turn Undo is enabled only when it matches the turn's `operationId`.
- **Web:**
  - `src/chat/store.ts` (Zustand) holds the turns, the live streamed turn, the draft, and staged files (uploaded as soon as they're picked).
  - `send()` marks the turn live first (so a double click can't send twice), flushes layout, sends the selection, and streams. On `done` it calls the Draw store's new `adoptChange(state, layout, changed)`. That adopts the design (only if it's newer), adds server-placed layout items, pushes a design undo step, and selects and zooms to the changed items.
  - `src/chat/ChatPanel.tsx` is the rail's new **Chat** tab (the collapsed rail has a chat button too):
    - example prompts to start from
    - the user message with file chips
    - the streamed reply and activity lines
    - "Changed:" chips that focus items on the board (connections show as "A → B")
    - `askUser` choice buttons (only on the newest turn)
    - a per-turn Undo (`useDraw.undoEdit(operationId)`)
    - Attach, Send (Ctrl/Cmd+Enter too), and a send-error line that keeps the draft
  - `src/settings/SettingsView.tsx`: provider key status with where to set it, the fake-model notice, and model fields per role with a Save button (saves only the roles that changed).

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 159 files in 38ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  22 passed (22)
      Tests  170 passed (170)
```

`pnpm test:e2e`:

```text
  ✓  [chromium] › apps/web/e2e/chat.spec.ts › a chat message draws a link shortener as one undo step
  ✓  [chromium] › apps/web/e2e/chat.spec.ts › askUser shows clickable choices and the answer continues the conversation
  ✓  [chromium] › apps/web/e2e/chat.spec.ts › an unknown capability becomes a needs-a-template element, and files can be attached
  ✓  [chromium] › apps/web/e2e/chat.spec.ts › settings show key status and save models per role
  ✓  (the 8 S4/S5 tests)
  12 passed (10.7s)
```

`npx playwright test --repeat-each 3`: 35 of 36 passed. The miss is the settings test racing with its own parallel repeats on the one shared settings file (see known issues); every other test passed in all three repeats. I also checked screenshots of the chat panel after a turn with a question card, in light and dark mode, plus the Settings page.

Coverage of the "Done when" checks (fake provider, `apps/server/src/chat/chat.test.ts`, PGlite):

- **"Make me a link shortener" creates valid elements and connections as one undo step:**
  - The script lists templates, describes one, and applies the link-shortener batch.
  - Result: 3 elements, `uses-database` + `calls` connections, zero findings, and streamed text, activity, and usage.
  - `history.latestEdit` equals the turn's `operationId`, and one `POST /undo` empties the design.
  - New elements are auto-placed (distinct positions, saved layout).
  - The e2e test does the same through the UI: it clicks the example, Send, and the turn's Undo (the board empties), then the toolbar's Redo (it's back). After a reload the conversation is still there. Axe reports zero violations.
- **An unknown capability becomes a "needs a template" element:** the model first tries `sms-gateway@0.1.0`. It's refused with `UNKNOWN_TEMPLATE`, and the refusal goes back to the model. It then adds the element with `template: null` and notes. The result is a `NEEDS_TEMPLATE` finding. This is also covered in e2e.
- **A stale edit is retried after re-reading:**
  - *Rebase:* a canvas edit lands mid-turn. The chat ops are replayed on revision 1 and committed; both changes survive, and `changed` lists only the chat's item.
  - *Redo:* the canvas deletes the element the chat wanted to connect. The replay fails, so the model gets the `[Jeeves]` note, calls `getDesign`, and redoes its edits. The final design is valid and is still one undo step.
- **Also covered:**
  - `askUser` stores the question and ends the turn, and the answer comes back with the question in history.
  - A provider auth error, or no key configured, fails the turn with nothing changed.
  - Unknown project or file, and an empty message, are refused.
  - Markdown, PNG, and SVG uploads reach the model as text and image parts (SVG as PNG plus source), and are served back.
  - Unsupported, mislabeled, empty, and unnamed uploads are refused.
  - Settings key precedence and mode 600.
  - Placement beside the selection, avoiding overlaps.
  - Providers: OpenAI SSE parsing via an injected `fetch` (text deltas, tool calls, reasoning replay, usage, request body), error mapping, the fake's replay and `scriptByMessage` rounds, and `assertSupported`.
  - The web chat store: streaming into the board, the per-turn undo, send failures that keep the draft, and choice sends.

**Manual smoke test with a real OpenAI key: not done.** There's no `OPENAI_API_KEY` in this environment and no `~/.jeeves/config.json`. To run it: `OPENAI_API_KEY=sk-… pnpm dev`, open the Chat tab, send "Make me a link shortener like bit.ly" (optionally attaching a Markdown brief), and check the board, Undo, and Settings ("API key set from the environment"). Check the default model name in Settings first; it's a guess.

### Deviations and choices the plan left open

- **Chat lives in the rail as a third tab**, not a separate docked panel. It's collapsible with the rail, and the collapsed rail has a chat button.
- **Edits are collected and committed at the end of the turn**, not as each tool call arrives, so a turn is always one operation. The model sees its pending edits through `getDesign` and `validateDesign`.
- **"Stale edit is retried after re-reading"** is done in two layers: first a silent replay of the same ops on the newer design, and only if that fails, a note that makes the model re-read and redo its edits.
- **Auto-placement runs on the server** after the commit, and the result comes back in `done.layout`. The client adds those positions for items it doesn't have, without overwriting local positions.
- **Streaming uses NDJSON over a POST response**, not SSE or WebSockets, read with `fetch` and a stream reader. A turn finishes and is saved even if the browser disconnects.
- **Uploads are raw bodies**, not multipart, so no `@fastify/multipart` dependency.
- **The per-turn Undo** only works while the turn is the newest server edit (via `latestEdit`). Otherwise it's disabled with a tooltip pointing to the toolbar's Undo. There's no targeted undo.
- **Model names are free text.** OpenAI's model list changes too often to hard-code a picker.

### Known issues

- The real OpenAI path is untested end to end (see above). Two things to check in that smoke test: that `include: ["reasoning.encrypted_content"]` is accepted for the chosen model, and that `strict: false` tools work with the large operation schema.
- The settings e2e test writes to one shared settings file, so `--repeat-each` runs race on it. Normal runs (one instance) are fine.
- There's no cancel button for a running turn, and no client-side timeout. A hung provider leaves the turn running until it errors.
- Replies are plain text (`white-space: pre-wrap`), not rendered Markdown, the same as notes in S5.
- Chat history sent to the model is the last 12 turns' text, without tool details. Long projects may want summarization later.
- Usage is recorded per turn (`usage.known`) but not shown in the UI yet; S11/S12's Runs view will want the same shape.

### For S7 and later

- S11's planner can reuse `ModelSource` (`apps/server/src/chat/service.ts`) and `providerModels(settings)` with `role: "planner"`. `ProviderError.blocksProvider` is the signal for `waiting_for_provider`.
- To test with the fake model in e2e, add turns to `fixtures/chat/e2e-script.json` (format in `fixtures/chat/README.md`).
- `history.latestEdit` is in `DesignState`; S5's toolbar undo doesn't need it, but anything wanting "undo exactly this step" does.

---

## S7: Template contract and first template harness (2026-10-29)

### Built

- **`packages/template-kit`** (new package, `@jeeves/template-kit`), the template contract from PLAN §8:
  - `src/contract.ts`: `TemplateModule` (manifest, `generate`, agent guide, test pack, runtime package), `GenerateContext`/`GenerateResult`, `OutputFile` with ownership `generated` | `scaffold`, `TestPack`/`TestCheck`, and the runner-facing `TestPackContext`/`ServiceHandle` (endpoint, exec, restart, stop, start). The doc comment there lists the package layout every template follows.
  - `src/context.ts`: `createGenerateContext(design, lookup, elementId, attachmentId?)` resolves config defaults, the element's directory (`elementDir`: services/frontends/packages/databases per §9; workers go in `services/`, externals in `externals/`), and incoming/outgoing connections with each peer's element, attachment, manifest and dir. Attachments get only the connections on that attachment. `manifestLookup(manifests)` is a `TemplateLookup` that doesn't need `@jeeves/registry` (using the registry from a template package would make a workspace cycle).
  - `src/compose.ts`: `mergeCompose` deep-merges fragments. A fragment may name another template's service (that's how `uses-database` adds `DATABASE_URL` and `depends_on` to the consumer). Arrays are unioned; two different scalars at one path throw `ComposeConflictError("services.api.environment.DATABASE_URL")`. `composeToYaml` sorts services, volumes, environment and depends_on, so the output doesn't depend on design order.
  - `src/scaffold.ts`: `renderScaffold(dir, targetDir, vars)` with `{{name}}` placeholders; an unknown name throws.
  - `src/test-pack.ts`: `runTestPack(pack, ctx, onResult)` runs checks in order and keeps going after a failure.
  - `@jeeves/template-kit/harness` (Docker; never imported by unit tests):
    - `buildProject({ dir, design, lookup, modules, stubs })` is a minimal generator. It runs `generate` per element and attachment, writes generated files always and scaffold files only when missing (`writeProjectFiles`), and writes the merged `docker-compose.yml`. Elements whose templates aren't built yet are replaced by `stubs` (a compose service per element ID).
    - `startProject(dir, { projectName })` runs Testcontainers' `DockerComposeEnvironment` with `docker compose up --wait`, so health checks and one-shot jobs finish first. It returns `service(name)` handles and `down({ volumes })`. Reusing a `projectName` starts the same project and volumes again.
- **`templates/postgres`**, complete:
  - `generate.ts`:
    - Writes `databases/<id>/init/10-consumers.sql` (generated-owned): an idempotent psql script that creates one `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE` role and one owned database per consumer. It revokes `CONNECT` from `PUBLIC` on each consumer database, on `postgres`, and on `template1`.
    - Compose gets the `<id>` service (`postgres:17-alpine`, `pg_isready` health check, `<id>-data` volume, port `127.0.0.1::5432`) and a one-shot `<id>-init` job that applies `init/*.sql`.
    - Each consumer gets `DATABASE_URL=postgres://<c>:<c>-local@<id>:5432/<c>` and `depends_on` on `<id>` (healthy) and `<id>-init` (completed successfully).
    - Consumers are sorted and deduplicated, and an element ID equal to `<id>-init` is refused.
  - `scaffold/consumer/`, rendered once into each consumer's directory: `src/db/schema.ts` (Drizzle, commented example), `drizzle.config.ts`, and `migrations/meta/_journal.json` (empty journal).
  - `runtime/`, the `@jeeves/postgres-runtime` package (its own workspace package, `templates/*/runtime` added to `pnpm-workspace.yaml`):
    - `databaseConfigFromEnv` reads `DATABASE_URL`, `DATABASE_POOL_MAX` (budget, default 5), `DATABASE_CONNECT_TIMEOUT_MS` and `DATABASE_MIGRATIONS`, and lists every problem in one readable error.
    - `createDatabase(config, { schema })` gives `{ pool, db (Drizzle), ready(), migrate(), close() }`, with an idle-error handler so a database restart doesn't crash the service.
    - `runMigrations` runs Drizzle's migrator under a Postgres advisory lock and returns `{ applied, total }`.
    - The `jeeves-db-migrate` bin runs it one-shot.
    - `pnpm build` emits `dist/` with declarations (TS 7 `rewriteRelativeImportExtensions`), and `publishConfig` points `exports` and `bin` at `dist/`, so `pnpm pack` produces a package Node can run from `node_modules`.
  - `test-pack/index.ts`, five checks:
    - the container is healthy and runs the configured major version
    - each consumer connects with its own role to its own database and can create tables
    - a consumer can't connect to other consumers' databases or `postgres` (expects SQLSTATE 42501) and has no elevated role flags
    - the applied Drizzle migrations equal the consumer's journal entries
    - a row survives a database restart, and the migrations are unchanged afterwards
    
    Consumer credentials come from the project's `docker-compose.yml` (not recomputed), so the checks test what was actually generated.
  - `agent-guide.md`, `template.ts` (the `TemplateModule`, exported as `@jeeves/template-postgres/template`; `.` still exports only the manifest so the web bundle stays Node-free), `generate.test.ts` (unit), and `conformance/postgres.conformance.ts`.
- **Root:** `pnpm test:templates` (`vitest.templates.config.ts`, files matching `templates/*/conformance/**/*.conformance.ts`, run serially with long timeouts). The root Vitest projects now include `templates/*/vitest.config.ts` and `templates/*/runtime`, so template unit tests run in `pnpm check`. Dependencies: `testcontainers` 12.2.1 and `yaml` 2.9.1. The optional `ssh2`/`cpu-features`/`protobufjs` build scripts are set to `false` in `allowBuilds`.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 197 files in 44ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  28 passed (28)
      Tests  192 passed (192)
```

`pnpm test:templates --reporter verbose` (Docker 29.9.1):

```text
 ✓ postgres conformance > generates the init job, wiring, and consumer scaffolds
 ✓ postgres conformance > test pack > the container is healthy and runs the configured major version
 ✓ postgres conformance > test pack > each consumer connects to its own database with its own role and can create tables
 ✓ postgres conformance > test pack > a consumer can't connect to other databases or act as a superuser
 ✓ postgres conformance > test pack > each consumer's database has exactly the migrations in its journal
 ✓ postgres conformance > test pack > data and migrations survive a database restart
 ✓ postgres conformance > consumer containers reach their database by service name through DATABASE_URL
 ✓ postgres conformance > migrations are idempotent: a second run applies nothing
 ✓ postgres conformance > concurrent migration runs (several replicas starting) apply each migration once
 ✓ postgres conformance > data survives a restart and a down/up that keeps the volume
 ✓ postgres conformance > regenerating with a new consumer keeps project files and creates its database on up
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  ~40s
```

No containers or volumes are left behind afterwards; only Testcontainers' reaper is still running, and it exits on its own. I also ran a mutation check: with the per-database `REVOKE CONNECT … FROM PUBLIC` removed, both isolation runs fail ("links could connect to database "stats"", "audit could connect to database "links""). I then restored it.

`pnpm test:e2e`: 12 passed. I re-ran it because `@jeeves/template-postgres`'s `exports` changed.

How the "Done when" items are covered: healthy container (check 1 plus `up --wait`); per-consumer database and role isolation (checks 2 and 3, plus a psql call from inside a consumer container using its `DATABASE_URL` and the service hostname); migrations applied on a clean volume and idempotent on restart (check 4, the re-run test, three concurrent runs, and runs after restart and after down/up); data survives restart (check 5, plus the `links` row across a restart and across a down/up that keeps volumes).

### Deviations and choices the plan left open

- **New package `packages/template-kit`.** It isn't in §14. The contract can't live in `@jeeves/spec` (the web app imports spec, and the contract needs `node:fs`, `yaml` and Testcontainers), and a template package can't depend on `@jeeves/registry` (cycle). S10's generator should build on it (`createGenerateContext`, `mergeCompose`, `composeToYaml`, `writeProjectFiles`).
- **Init SQL is applied by a one-shot `<id>-init` compose job on every `up`,** not through `docker-entrypoint-initdb.d`. The entrypoint only runs on an empty volume, so a consumer added by regeneration would never get its database. The script is idempotent (`\gexec` guards, `ALTER ROLE`), and this is tested.
- **Fixed local-only passwords** (`postgres`/`postgres`; `<consumer>-local`). Generated output must be deterministic, and the port is bound to `127.0.0.1` only. These aren't API keys, but any future cloud target needs real secrets.
- **The database port is published on an ephemeral loopback port** (`127.0.0.1::5432`), so test packs and tools can reach it and two projects don't clash. Use `docker compose port <id> 5432` to find it.
- **Drizzle** for template migrations (the brief's open question), with a scaffolded `drizzle.config.ts` in each consumer.
- **Conformance consumers are stubs** (`postgres:17-alpine` running `sleep`, with `init: true`) because http-service doesn't exist yet. The harness applies migrations through the runtime, standing in for a service's startup.
- **The conformance suite isn't in CI-style `pnpm check`** because it needs Docker (AGENTS.md: unit tests must not need Docker).

### Known issues

- **One database per consumer:** if a service has `uses-database` to two postgres elements, both set `DATABASE_URL`, and generation fails with a `ComposeConflictError`. The http-service manifest's `uses-database` out port should probably be `multiple: false` so the canvas refuses it up front (S8).
- **Element ID clash:** an element whose ID equals `<db>-init` is refused at generate time, not by design validation.
- **Removing a consumer doesn't drop anything:** its role and database stay (per §9, nothing is deleted automatically).
- **Cold start:** the first `pnpm test:templates` on a machine pulls `postgres:17-alpine` and the Ryuk image.

### For S8 and later

- **S8 (http-service):**
  - Add `"@jeeves/postgres-runtime"` to the service's `package.json` when `runtimeDependencies` names it.
  - Create the database in `src/jeeves.generated.ts` with `createDatabase(databaseConfigFromEnv(), { schema })`, call `migrate()` before listening, and use `ready()` for `/ready`.
  - Add `drizzle-kit` and `drizzle-orm` to the scaffolded service's dependencies (the postgres scaffold's `drizzle.config.ts` expects them).
  - Swap the conformance stubs for the real http-service module.
  - `ServiceHandle.stop()`/`start()` exist for the "/ready is 503 with the dependency stopped" check.
- **S10 (generator):**
  - Call `TemplateModule.generate` with `createGenerateContext` for each element and attachment, and merge fragments with `mergeCompose`.
  - `pnpm pack` in `TemplateModule.runtime.dir` gives the vendored tarball (`prepack` builds `dist/`).
  - Test packs need a `TestPackContext` backed by the compose CLI instead of Testcontainers. Checks only use `ctx.compose`, `ctx.subject`, `ctx.projectDir` and `service()` handles, so that should be a small adapter.
  - Copy `agentGuide` into `jeeves/elements/<id>.md`.

---

## S8: http-service and rest-api-server templates (2026-10-29)

### Built

- **`@jeeves/service-runtime`** (`templates/http-service/runtime`, Fastify 5.12.7, Zod 4.5.4):
  - `defineService` (what the generated wiring declares: name, defaults from the element config, `dependencies`, `plugins`), `createService` (builds without opening the port; tests use `app.inject`), `runService`, and `startService` (what `src/main.ts` calls).
  - Environment validated with Zod: `PORT`, `HOST`, `LOG_LEVEL`, `SHUTDOWN_TIMEOUT_MS`, `READY_TIMEOUT_MS`, plus each dependency's `configure(env)` and each feature's own `env` shape. Every problem is reported at once (`Service "links" can't start: invalid environment` followed by `  - PORT: must be a whole number from 1 to 65535 (got "x")`), and the process exits 1 with no stack trace.
  - `/health` (liveness) and `/ready` (each dependency's `ready()` with a timeout; 503 `not-ready` or `shutting-down`). Health and readiness requests aren't logged.
  - Graceful shutdown on SIGTERM/SIGINT: stop taking requests, finish in-flight ones (responses during shutdown send `Connection: close`, otherwise keep-alive sockets hold `close()` up), then features' `stop()` and dependencies' `close()` in reverse. It exits 0, or 1 after `SHUTDOWN_TIMEOUT_MS`.
  - `defineFeature({ name, env?, operations?, register?, start?, stop? })` and `loadFeatures(dir)`, which imports `src/features/<name>/index.ts` in name order and skips `_`/`.` folders. `operations` are handlers by `operationId` for a plugin that `servesOperations`; declaring operations with no such plugin, or one operation in two features, stops startup.
  - Re-exports `z`, so features don't need their own Zod.
- **`postgresDependency({ name, schema, migrationsFolder })`** in `@jeeves/postgres-runtime`: a `Dependency` (matching the service runtime's shape structurally, with no import). It checks the environment with the service's, migrates before features start, answers `/ready`, closes the pool, and exposes `db` (Drizzle) and `pool`.
- **`templates/http-service`**:
  - Scaffold (`scaffold/service`, project-owned): `package.json` (`start`, `typecheck`, and `test` scripts; dev dependencies typescript 7.0.2, @types/node, vitest), `tsconfig.json` (NodeNext, `erasableSyntaxOnly`), a `Dockerfile` (`node:24.22.2-alpine`; `npm install --omit=dev` in the service dir; runs `node src/main.ts` with type stripping, so there's no build), `Dockerfile.dockerignore`, `src/main.ts`, `src/features/README.md`, and `test/README.md`.
  - `generate.ts`:
    - Generated `src/jeeves.generated.ts`: `export const service = defineService(...)`, `export const database = postgresDependency(...)` when a postgres element is connected, and `restServer({ contract, basePath, auth })` when the element has a rest-api-server attachment.
    - Compose service:
      - built from the project root with `dockerfile: services/<id>/Dockerfile`
      - environment: `PORT`, `LOG_LEVEL`, `SHUTDOWN_TIMEOUT_MS=10000`
      - port `127.0.0.1::<port>`
      - a health check that runs `node -e fetch(.../ready)`
      - `stop_grace_period: 15s`, `restart: unless-stopped`
      - `depends_on` for `depends-on` connections
    - Runtime dependency `@jeeves/service-runtime`.
    - Refuses a non-postgres database or more than one database.
  - Test pack (4 checks): `health`; `ready` (200, then stops the connected database, expects 503 naming it, restarts it, and expects 200 again); `config-validation` (one-off container with `PORT=not-a-port LOG_LEVEL=chatty`: non-zero exit, both problems named, no stack trace); `graceful-shutdown` (`docker stop` gives exit code 0 within `SHUTDOWN_TIMEOUT_MS`; it then starts the service again).
  - `agent-guide.md`, `template.ts` (`@jeeves/template-http-service/template`), `generate.test.ts`, and the conformance test.
  - Manifest: the `uses-database` out-port is now `multiple: false` (S7's known issue).
- **`@jeeves/rest-server`** (`templates/rest-api-server/runtime`; Ajv 8.20.0 + ajv-formats 3.0.1, yaml 2.9.1; `fastify` and `@jeeves/service-runtime` are optional peers, used for types only):
  - `loadContract`/`parseContract`: OpenAPI 3.1 only. It resolves local `$ref`s on parameters, request bodies and responses, and merges path-level and operation-level parameters. It reports every problem (wrong version, missing or duplicate `operationId`, bad YAML) in a `ContractError`.
  - `createValidators(contract)`: per-operation request validation (path, query and header values coerced with defaults; JSON body) and response validation by status (exact, then `2XX`, then `default`). Component schemas resolve because the document is registered in Ajv and local refs are rewritten to point at it.
  - `restServer({ contract, basePath, auth, responseValidation })` is a `ServicePlugin`:
    - Routes every operation under `basePath`.
    - Error responses:
      - 400 `REQUEST_INVALID` with `details: [{ in, path, message }]`, also for malformed JSON
      - 404 `NOT_FOUND` under the base path
      - 501 `NOT_IMPLEMENTED` for operations with no handler (also logged at startup)
      - 500 `RESPONSE_INVALID` for an undocumented status or a schema-invalid body (`responseValidation: "warn"` only logs)
    - A handler for an operation that isn't in the contract stops startup.
    - Serves `/openapi.json` (with `servers` set to the real base path) and `/_jeeves/operations` (each operation and whether, and by which feature, it's implemented).
    - `auth: "bearer"` requires `REST_BEARER_TOKEN` (an environment problem if unset) and compares it in constant time.
- **`templates/rest-api-server`**:
  - Scaffold: `contracts/<service>.openapi.yaml` (a `GET /ping` with an optional `message` query parameter, `maxLength` 64, with an example; `Pong` and `Error` schemas; a `BadRequest` response) and `<service dir>/src/features/ping/index.ts`.
  - `generate.ts`: those scaffold files, `REST_BEARER_TOKEN=<id>-local-token` in compose when `auth: bearer`, and runtime dependency `@jeeves/rest-server`.
  - Test pack (4 checks, all driven by the project's contract file):
    - `openapi-served`: the served paths match the file, and `servers[0].url` equals the base path
    - `handlers`: every operation in `/_jeeves/operations` is implemented, and the running image serves every operation in the file
    - `contract-smoke`: every GET operation (or any with `x-jeeves-smoke: true`) whose required parameters and body have examples is called, and the response is validated against the contract on the client side
    - `invalid-requests`: per operation, one broken rule (a non-object body, a too-long, non-numeric or out-of-enum query or header value, or a missing required query parameter) must get a 400 `REQUEST_INVALID` with details
  - `agent-guide.md`, `template.ts`, `generate.test.ts`, `test-pack/index.test.ts` (runs the pack against an in-process service, including "no handler" and "invalid response" failures), and the conformance test.
- **Template-kit (additive changes):**
  - `GenerateResult.packageDependencies` (registry packages with exact versions, optionally dev) and `GenerateContext.attachments` (the element's attachments with manifests and resolved config).
  - `ServiceHandle.stop({ graceSeconds })` now returns `{ exitCode }`, and there's a new `ServiceHandle.run({ env, command })` (`docker compose run --rm --no-deps --no-TTY`).
  - `packages.ts`: `VENDOR_DIR`, `runtimeTarballName` (the `pnpm pack` naming), `vendoredRuntimeSpec(elementDir, name, version)` (`file:../../vendor/jeeves/…tgz`), and `mergePackageDependencies` (adds missing dependencies only and never changes listed ones; sorts the maps it touches).
  - Harness:
    - `vendorRuntimes(dir, modules)` runs `pnpm pack` into `vendor/jeeves/`.
    - `buildProject` adds each element's runtime and package dependencies to its `package.json` (skipping stubs).
    - `down({ images: true })` and dispose remove the images compose built.
- **postgres:** `generate` now also gives each consumer `drizzle-orm` 0.45.4 and the `drizzle-kit` 0.31.11 dev dependency. The new `conformance/service-with-postgres.conformance.ts` runs two real http-service consumers.
- Runtime `prepack` scripts run `tsc -p tsconfig.build.json` directly, not `pnpm build`, so packing works where `pnpm` is only reachable through corepack.
- Docs: the open questions in the http-service and rest-api-server briefs are answered; the PLAN progress line and the README's template line are updated.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 247 files in 53ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  35 passed (35)
      Tests  235 passed (235)
```

`pnpm test:templates` (Docker 29.9.1, after `pnpm format`):

```text
 Test Files  4 passed (4)
      Tests  45 passed (45)
   Duration  198.14s
```

The three "Done when" scenarios, from the per-file `--reporter verbose` runs:

```text
http-service.conformance.ts — a service alone (6)
 ✓ references the vendored runtime from the service's package.json
 ✓ test pack > the container starts and /health returns 200
 ✓ test pack > /ready returns 200 with dependencies up and 503 with one stopped
 ✓ test pack > a bad environment is rejected with a readable error
 ✓ test pack > SIGTERM shuts the service down cleanly within the timeout
 ✓ the generated service type-checks against the packed runtime

rest-api-server.conformance.ts — http-service with a rest-api-server attachment (11)
 ✓ scaffolds the contract and wires the server into the service
 ✓ the ping operation answers under the base path
 ✓ rest-api-server test pack > /openapi.json serves the contract
 ✓ rest-api-server test pack > every operation in the contract has a handler
 ✓ rest-api-server test pack > documented examples get schema-valid responses
 ✓ rest-api-server test pack > invalid requests get 400 with a structured error
 ✓ http-service test pack > (all 4 checks)
 ✓ the service with its API type-checks

service-with-postgres.conformance.ts — http-service plus postgres (17)
 ✓ adds the database runtime and Drizzle to each service's package.json
 ✓ a feature writes to and reads from the service's own database
 ✓ postgres test pack (services applied their migrations at startup) > (all 5 checks)
 ✓ http-service test pack for links > (all 4 checks; /ready went 503 with main-db stopped)
 ✓ http-service test pack for stats > (all 4 checks)
 ✓ data written before restarts is still there, and the service reconnected
 ✓ the service with a database and a feature type-checks
```

The S7 postgres conformance (11 tests) still passes. The type-check tests run `npm install` and `npm run typecheck` on the host in the generated service directory, so they need network access, as the Docker image builds do. No containers or images were left behind afterwards.

`pnpm test:e2e`: 12 passed (the manifests and package exports changed).

### Deviations and choices the plan left open

- **Fastify** (PLAN §16), as assumed.
- **No OpenAPI library besides Ajv.** `fastify-openapi-glue` can't validate responses, only serialize them. A ~200-line loader plus Ajv 2020 does what the brief asks, with error shapes we control. Only OpenAPI 3.1 is accepted; 3.0 contracts are refused with a clear message.
- **Features are discovered from folders**, not registered in `main.ts`, so an attachment added by regeneration (rest-api-server's `ping`) works even though `main.ts` is project-owned and already written.
- **Generated services run TypeScript directly** with Node 24's type stripping (no build step in the image). The scaffold's `tsconfig.json` sets `erasableSyntaxOnly`, so `pnpm typecheck` catches what Node can't strip, and the agent guide says so. The runtimes ship compiled `dist/`, because Node won't strip types inside `node_modules`.
- **Images build from the project root** with a per-Dockerfile `Dockerfile.dockerignore`, so vendored runtimes and `contracts/` are in the build context without sending the whole project. The Dockerfile uses `npm install` (no lockfile) because the image installs one service, not the pnpm workspace; dependency versions are pinned exactly, but transitive ones aren't locked yet.
- **`package.json` is project-owned, but dependencies get added to it.** Templates declare `runtimeDependencies` and `packageDependencies`, and generation adds the missing ones (never changing or removing any). This is how a database or API attachment added later reaches an existing service. S10 should do the same and needn't hash `package.json`.
- **The compose health check probes `/ready`**, not `/health`, so `up --wait` means "dependencies reachable". `replicas` isn't used in compose (as the brief says: local Docker runs one).
- **Bearer auth** is a single local token from compose (`<id>-local-token`), like S7's fixed local passwords. It's a placeholder, as the brief says.
- **The REST API reports itself at `/_jeeves/operations`**, so the "every operation has a handler" check can see what the running image actually implements.
- **The service plus Postgres conformance test lives in `templates/postgres/conformance/`**: importing the postgres template from http-service would make a workspace dependency cycle (postgres already depends on the http-service manifest). The http-service unit tests use stand-in manifests with the real IDs for the same reason. The S7 stub-based postgres conformance test stays as it was, and the new file covers real consumers.
- **`contractPath()`** exists in both http-service and rest-api-server `generate.ts` (same cycle reason). They must stay in sync: `contracts/<service id>.openapi.yaml`.

### Known issues

- No lockfile inside service images (see above). S10 may want to generate one per service, or install from the workspace lockfile with `pnpm deploy`.
- The `graceful-shutdown` check doesn't hold a request open during the stop; that path is covered by the runtime's unit test (`finishes in-flight requests during a graceful shutdown`).
- A contract with only GET operations that have no examples gets no smoke requests (the check logs `ran 0` and passes). The agent guide tells agents to add examples.
- `@jeeves/postgres-runtime`'s `DatabaseConfigError` still uses a constructor parameter property. That's fine because the runtime ships compiled, but it's the one non-strippable spot left in the runtimes.
- First run cold start: pulls `node:24.22.2-alpine` and installs from npm in each image build (~40 s per scenario after that, thanks to the build cache).

### For S9 and later

- **S9 (rest-api-client, web-app):**
  - The client's `calls` wiring for a service belongs in http-service's `wiringOf`/`wiringSource` (it already reads `ctx.attachments`; add the client attachment and the outgoing `calls` connections there).
  - The target's contract is `contracts/<target id>.openapi.yaml`, and its base path is the target's rest-api-server attachment `basePath` (`peer.attachment.config`; apply defaults through the peer manifest).
  - A server with `auth: bearer` reads `REST_BEARER_TOKEN`. A client in compose can get the same value (`<target id>-local-token`) from the client template's compose fragment.
  - `@jeeves/rest-server` exports `loadContract` and `createValidators` if the client's test pack wants contract-side checks.
  - A web-app talking to a service should go through `depends_on` with `service_healthy` (services have a `/ready` health check).
- **S10 (generator):**
  - Reuse `vendorRuntimes` (or the same `pnpm pack` call), `vendoredRuntimeSpec`, and `mergePackageDependencies`. Apply `packageDependencies` too.
  - The compose-CLI `TestPackContext` adapter must implement `ServiceHandle.stop()` returning `{ exitCode }` (`docker stop` then `docker inspect`) and `run()` (`docker compose run --rm --no-deps --no-TTY -e …`). See `packages/template-kit/src/harness/environment.ts`.
  - http-service's test pack stops and restarts the database and the service, so run packs in an order where that's acceptable. The postgres pack and the http-service pack both restart things and both leave everything running.
  - A project needs `vendor/jeeves/` before `docker compose build`, because every service Dockerfile copies it.

---

## S9: web-app and rest-api-client templates (2026-10-29)

### Built

- **`@jeeves/rest-client`** (`templates/rest-api-client/runtime`; openapi-fetch 0.17.0, yaml 2.9.1). It has three entry points.
  - **`.`** (browser and Node): `createRestClient<paths>({ name, baseUrl, timeoutMs, retries, headers, requestId, fetch })` returns an openapi-fetch client.
    - The base URL is resolved on every call, so it can come from the environment or the runtime config.
    - Error statuses come back as `{ error, response }`, typed from the contract, as openapi-fetch returns them.
    - A call that gets no response throws `RestClientTimeoutError` or `RestClientNetworkError`. Both are `RestClientError` with `code` `TIMEOUT` or `NETWORK`, plus `client`, `method`, `url` and `attempts`. The timeout is per attempt and runs until the response headers arrive. A caller's own abort is passed through unwrapped.
    - Retries apply only to idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE), after a timeout, a network error or a 502/503/504, with backoff of 100 ms doubling up to 2 s. POST and PATCH are never retried.
    - Every call sends `x-request-id`: the caller's own, the handled request's, or a new UUID. Retries share it.
  - **`./service`** (Node): `serviceRestClient<paths>({ name, basePath, urlEnv, tokenEnv?, timeoutMs, retries })`.
    - It reads `API_<TARGET>_URL` (and `API_<TARGET>_TOKEN`, sent as `Authorization: Bearer`) from the environment.
    - It exposes `.plugin`, a service plugin (matched structurally, so there's no import of the service runtime). The plugin's `configure(env)` adds the client's problems to the service's startup report (`API_LINKS_URL: must be an http(s) URL (got "links:8080")`). Its `register(app)` adds an `onRequest` hook that keeps the handled request's ID in `AsyncLocalStorage`, so calls made while handling a request forward that ID.
    - Used outside a service (scripts, tests), it reads `process.env`.
  - **`./codegen`** and the **`jeeves-rest-client-types`** bin:
    - The bin runs in an element directory. For each `src/clients/*.generated.ts`, it reads the `// @jeeves-contract <path>` line and writes `src/clients/<target>.openapi.ts` from that contract. A file that's already up to date isn't rewritten.
    - The generator (`contractTypes`, in `src/types.ts`) emits the same shape openapi-typescript does (`paths`, `components`, `operations`, `webhooks`, `$defs`).
    - It handles local `$ref`s (schemas, responses, parameters, request bodies, headers), path-level parameters merged with operation-level ones, type arrays, `enum`/`const`, `oneOf`/`anyOf`/`allOf`, `additionalProperties`, `prefixItems`, and descriptions as JSDoc.
    - It reports every problem at once: a version other than 3.1, a missing or duplicate `operationId`, a dangling `$ref`.
    - It's covered by a golden file, and `test-fixtures/usage.ts` (compiled by `pnpm typecheck`) checks the output against openapi-fetch, including `@ts-expect-error` lines for a missing path parameter, a wrong body, an unknown path and a missing method.
- **`templates/rest-api-client`**:
  - `generate.ts` writes `src/clients/<target>.generated.ts` (generated-owned) inside the calling element. It exports `<camelTarget>Client` (`links` becomes `linksClient`, `link-store` becomes `linkStoreClient`), configured from the design: base path, timeout, retries, and a token variable when the target uses `auth: bearer`.
    - On an http-service it uses `serviceRestClient`.
    - On a web-app it uses `createRestClient` with ``baseUrl: () => `${apiUrl("<target>")}<basePath>` ``.
  - Compose: the caller gets `API_<TARGET>_URL=http://<target>:<port>`, `API_<TARGET>_TOKEN=<target>-local-token` when the API uses bearer auth, and `depends_on: <target>: service_healthy`.
  - It adds the runtime dependency `@jeeves/rest-client` and the package script `pretypecheck: jeeves-rest-client-types`, so `npm run typecheck` and `pnpm typecheck` regenerate the types from the current contract first. I confirmed pnpm 12 runs `pre` scripts.
  - It refuses (with a clear message) a client with no `calls` connection, two clients for the same target on one element, and a host other than http-service or web-app.
  - Test pack, 3 checks:
    - `types`: `npm run typecheck` in the calling element on the host
    - `call`: a documented GET through the generated client inside compose. It uses `/ping` when the contract has it, otherwise the first GET whose examples make a request.
    - `timeout`: a call that gets no answer fails with `RestClientTimeoutError`/`TIMEOUT`
    
    For a service, the calls run as a one-off `node --eval` script in the service's container that imports the generated module (for `timeout`, it points the client at a local socket that never answers). For a web-app, they run in Chromium through the page's own client (`window.__JEEVES__.apis`); for `timeout`, Playwright holds `/_api/<target>/**` requests.
  - `agent-guide.md`, `template.ts`, `generate.test.ts`, and `conformance/rest-api-client.conformance.ts`.
- **`@jeeves/web-runtime`** (`templates/web-app/runtime`; React 19 as a peer, Vite as an optional peer):
  - `defineApp({ name, title, apis })`, which is what the generated wiring declares.
  - `startApp(app, <App />)`:
    - It fetches `/jeeves-config.json` (no-store), checks it (`title`, `apis.<name>.url`, every problem at once), sets `document.title`, and exposes `window.__JEEVES__ = { app, config, apis }`.
    - It renders the app in `StrictMode`, inside a `JeevesProvider` and an `ErrorBoundary`. If the config can't load, it renders an alert saying why.
    - At `/_jeeves/status` it renders the status page instead of the app.
  - `useRuntimeConfig()`, `useApis<typeof app.apis>()`, `runtimeConfig()`, and `apiUrl(name)` (which generated browser clients call).
  - `JeevesProvider`, for tests to pass a config and fake clients.
  - `ErrorBoundary`: an optional `fallback(error, reset)`; the default is an alert with a "Try again" button.
  - The status page shows the runtime config and a mouse-usable form (API, GET path, Call) that calls through the generated client. `?api=<name>&path=<path>` calls right away; the result is in `[data-jeeves-result=<name>]` with `data-jeeves-ok`, and typed errors show their `code`.
  - `nginx/40-jeeves-config.sh` (shipped in the tarball) runs from the nginx image's `/docker-entrypoint.d/`. It fills `${NAME}` in `/etc/jeeves/config.json.template` with JSON-escaped environment values, substituting only the template's own variables.
  - `@jeeves/web-runtime/vite` exports `jeevesDev({ title })`, a serve-only Vite plugin. It serves the runtime config from the same template and proxies `/_api/<name>` to `API_<NAME>_URL` (adding the token). An unconfigured API gets a 502 that names the variable to set.
- **`templates/web-app`**:
  - Scaffold (`scaffold/app`, project-owned):
    - `package.json`: `dev` (`vite --port <port> --strictPort`), `build`, `typecheck` and `test` scripts; React 19.2.8; Vite 8.2.2, @vitejs/plugin-react 6.1.1, TypeScript 7.0.2, Vitest 5.0.0
    - `tsconfig.json`, `vite.config.ts`, `index.html`, `public/favicon.svg` (without it the favicon 404 is a console error), `src/main.tsx`, `src/App.tsx`, `src/pages/Home.tsx`, `src/styles.css`
    - a two-stage `Dockerfile` (`node:24.22.2-alpine` build, `nginx:1.30.5-alpine` serve) and `Dockerfile.dockerignore`
    
    The title is escaped for JSON, JS strings and HTML. Placeholders sit only inside strings and comments so Biome can parse the scaffold.
  - Generated:
    - `src/jeeves.generated.ts`: `defineApp` with each client under its target ID.
    - `nginx/default.conf.template`, which:
      - listens on `${PORT}`
      - serves `/healthz`
      - sends `no-store` for the config and `no-cache` for `index.html`
      - caches `/assets/` immutably
      - has one `location /_api/<target>/` per client, which rewrites to the service root and uses `proxy_pass` with a variable and `resolver 127.0.0.11 valid=10s`, so a restarted service's new address is picked up
      - adds `Authorization: Bearer ${API_<TARGET>_TOKEN}` server-side for bearer APIs
      - falls back to `index.html` for client-side routes
      
      The Dockerfile sets `NGINX_ENVSUBST_FILTER=^(PORT|API_)` so nginx's own `$uri` and friends are left alone.
    - `nginx/jeeves-config.json.template`: `{ title: ${APP_TITLE}, apis: { <target>: { url: "/_api/<target>" } } }`.
  - Compose: built from the project root; `PORT` and `APP_TITLE` (with `$` escaped as `$$`); port `127.0.0.1::<port>`; a `wget /healthz` health check; `restart: unless-stopped`; `depends_on` for `depends-on` connections.
  - Test pack, 4 checks:
    - `page-loads`: `#root` rendered, no console errors or page errors, network idle
    - `client-routes`: a deep path serves the app
    - `runtime-config`: `/jeeves-config.json` and `window.__JEEVES__.config` equal what the design and compose say, and the page title is applied
    - `sample-call`: for each client, `/_jeeves/status?api=…&path=…` renders an OK result, with no console errors
  - `agent-guide.md`, `template.ts`, `generate.test.ts`, and `conformance/web-app.conformance.ts`. The manifest's port description now says the port is also the container port.
- **`@jeeves/service-runtime`:** Fastify now uses `requestIdHeader: "x-request-id"` and `genReqId: randomUUID`, and every response carries `x-request-id`. A service adopts its caller's ID, and logs line up across services.
- **http-service:** `wiringOf` and `wiringSource` add each rest-api-client's `<target>Client.plugin` to the service's plugins (imported from `./clients/<target>.generated.ts`). The fixtures have a rest-api-client stand-in and a `client` option.
- **Template-kit (additive changes):**
  - `ResolvedEnd.elementManifest` (the peer element's own manifest, when the end is an attachment).
  - `ResolvedAttachment.incoming` and `.outgoing` (each attachment's connections, seen from the element's context).
  - `GenerateResult.packageScripts` with `mergePackageScripts` (adds missing scripts and never changes existing ones). The harness applies it.
  - `conventions.ts`: `contractPath` and `bearerToken` (moved here; http-service and rest-api-server re-export them, so S8's duplicate is gone), `apiEnvName`, `clientModulePath`, `clientExportName`, and `restClientTargets(ctx)` (each client attachment with its target, the server's base path and auth, and the target's port).
  - `@jeeves/template-kit/browser`: `withPage(fn)` (headless Chromium, collecting console and page errors) and `assertNoPageProblems`. It depends on `@playwright/test` 1.63.0 (already the root's version).
- `@jeeves/template-rest-api-server` now also exports `./test-pack` (for `exampleRequest`).
- Docs: the web-app brief's open question is answered and the rest-api-client brief's types note is updated. The PLAN progress line and the README's template and `test:templates` lines are updated.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 304 files in 102ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  44 passed (44)
      Tests  285 passed (285)
```

`pnpm test:templates` (Docker 29.9.1, after `pnpm format`, all six conformance files):

```text
 Test Files  6 passed (6)
      Tests  70 passed (70)
   Duration  330.09s
```

The S9 scenarios, from the per-file `--reporter verbose` runs (all passed on the first run):

```text
rest-api-client.conformance.ts — an http-service (stats) calling another (links, bearer, /v1) (10)
 ✓ generates the client, its runtime, the types script, and the compose wiring
 ✓ forwards the request ID and the bearer token on calls a request makes
 ✓ rest-api-client test pack > the generated client type-checks against the target's contract
 ✓ rest-api-client test pack > a call to the target API succeeds inside compose
 ✓ rest-api-client test pack > a call that gets no answer fails with a typed timeout error   2240ms (1 s × 2 attempts)
 ✓ http-service test pack for the calling service > (all 4 checks)
 ✓ the generated types follow the contract: a removed operation becomes a type error

web-app.conformance.ts — a web-app (web) calling links through a generated client, plus docs (no APIs) (15)
 ✓ generates the wiring, the proxy, the runtime config template, and the compose service
 ✓ the page shows data from the service, fetched through the generated client
 ✓ the proxy finds the service again after it restarts
 ✓ web-app test pack for web > (all 4 checks)
 ✓ rest-api-client test pack for web's client > (all 3 checks, in Chromium)
 ✓ web-app test pack for docs (no APIs) > (all 4 checks)
 ✓ both apps type-check, the client against the service's contract
```

The web app's title is `Links & "Co" $5 <beta>`, so the JSON (config script), HTML (`index.html`), JS (`vite.config.ts`) and compose (`$$`) escaping are all exercised end to end. The S7 and S8 suites (postgres, http-service, rest-api-server, service-with-postgres) still pass in the same run. No containers or images were left behind. The type-check steps run `npm install` on the host, and the image builds pull from npm, so these tests need network access.

`pnpm test:e2e`: the first run after the conformance suite had 3 failures in `chat.spec.ts` (fake-provider text not visible within 5 s). The spec passed alone (4 of 4), and two more full runs passed 12 of 12. I couldn't reproduce it; it looks like a timing flake under load rather than an S9 change, since S9 touches no chat code. Watch for it.

### Deviations and choices the plan left open

- **Client types aren't made by openapi-typescript.** It builds its output with the TypeScript 5 compiler API, and the generated projects (like this repo) use TypeScript 7, whose `typescript` package has no JS API (`Object.keys(require("typescript"))` is just `version` and `versionMajorMinor`). Installing TS 5 next to it would conflict on the `typescript` peer and add the compiler to every service image. So `@jeeves/rest-client` has a ~350-line generator that emits the same shape openapi-fetch expects, for the JSON Schema subset that `@jeeves/rest-server` contracts use.
- **Types follow the contract, not the design.** The contract is project-owned and agents change it during orchestration, so types can't be fixed at generation time. The generated client module is design-derived and generated-owned; `<target>.openapi.ts` is derived from the contract by `pretypecheck`. The type-only import is erased by Node's type stripping and by Vite, so images don't need it.
- **Browsers reach APIs through the web app's own nginx** (`/_api/<target>/` to `http://<target>:<port>/`), not directly. The service ports are ephemeral loopback ports, this avoids CORS, and the bearer token stays server-side. The runtime config holds the browser-facing path, and the upstream address comes from the container's environment at start (the brief's "runtime config injection").
- **Environment names are `API_<TARGET>_URL` and `API_<TARGET>_TOKEN`.** The prefix avoids clashes such as a target named `database` taking `DATABASE_URL`. The value is the service's origin; the base path comes from the design and is in the generated client.
- **nginx listens on the design's `port`** inside the container, the same number as the dev server, so there's one port per element as with services.
- **Generated frontends are unstyled** (plain CSS) rather than Mantine. See the brief.
- **The diagnostics page `/_jeeves/status` is part of the runtime**, not the scaffold. The web-app test pack needs something that renders a call result and that agents won't rewrite. It's in every build, which is fine for local v1.
- **Test packs drive a browser on the host** (Playwright's Chromium), and the client's `types` check runs `npm run typecheck` on the host, which needs installed `node_modules`. Both match how S10's baseline check runs (install first, then the packs).
- **service-runtime change** (an earlier section's code): request-ID adoption was needed for the brief's "request-ID propagation" to mean anything across services. It's small and covered by the new rest-client service tests.

### Known issues

- `src/clients/<target>.openapi.ts` is neither hashed in the lock nor scaffolded. S10 should leave it out of ownership checks; it can be committed or ignored, since typecheck rewrites it.
- The client timeout covers the time until the response headers arrive, not reading a slow body.
- nginx's `rewrite` decodes the path before proxying, so an encoded `%2F` in a path segment reaches the service as `/`.
- After a service restarts, the proxy may keep the old address for up to 10 s (`resolver … valid=10s`). Compose usually keeps the address, and the conformance restart recovered at once.
- Web images, like service images, `npm install` without a lockfile (S8's known issue).
- The `timeout` check takes the client's `timeoutMs × (retries + 1)` plus backoff: 5 s with the defaults.
- `jeevesDev` needs `API_<NAME>_URL` set by hand from `docker compose port …`. Dev mode isn't covered by conformance tests, only by unit tests of the plugin.
- Cold start: pulls `nginx:1.30.5-alpine` and installs React, Vite and friends in the web image build (~60 s the first time).

### For S10 and later

- **Generator:**
  - Apply `packageScripts` with `mergePackageScripts`, alongside `runtimeDependencies` and `packageDependencies` (see `addElementDependencies` in `packages/template-kit/src/harness/project.ts`).
  - Vendor all five runtimes. A web-app's Dockerfile copies `@jeeves/web-runtime/nginx/40-jeeves-config.sh` out of its build stage's `node_modules`.
- **Baseline check:** install before running packs, and make sure Playwright's Chromium is available on the host (the web-app and client packs launch it).
  - Run the web-app and rest-api-client packs before the http-service packs, or give the proxy ~10 s after them: http-service's checks restart services.
  - The client packs for a service call `docker exec` in the calling service's container.
- **`ResolvedAttachment.outgoing`** is how an element template sees its attachments' connections. Use `restClientTargets(ctx)` rather than re-deriving client targets.
- **Orchestrator (S11/S12):**
  - An agent changing a contract should run `pnpm typecheck` in every element that calls that API: the types are regenerated there, and breaking changes show up as type errors.
  - The rest-api-client conformance test shows this: renaming `/request-id` in the contract makes `src/features/relay/index.ts` fail to type-check.

---

## S10: Generator (2026-10-29)

### Built

- **`@jeeves/generator`** (`packages/generator`):
  - `planProject(design, templates, { projectName })` (`src/plan.ts`) is pure and deterministic. It runs each template's `generate` for every element and attachment (through `createGenerateContext`), merges compose fragments into `docker-compose.yml`, and adds the project documents:
    - `jeeves/design.json`: the design snapshot.
    - `jeeves/elements/<id>.md`: name, template, directory, owned paths, implementation notes, resolved config, attachments with their config and notes, connections, then each template's agent guide.
    - `AGENTS.md`: an element table, ownership rules, and the checks to run.
    - Root scaffolds (project-owned): `package.json`, `pnpm-workspace.yaml` (`services/*`, `frontends/*`, `packages/*`), `.gitignore` (ignores the derived `src/clients/*.openapi.ts`), and `tests/e2e/README.md`.
    
    It returns the files (sorted, with ownership), the `package.json` edits per element (vendored runtime specs, package dependencies, scripts), the runtimes to vendor, the elements with their **owned paths** (the element directory plus project-owned files its templates scaffold outside any element directory, e.g. `contracts/links.openapi.yaml`), and the test-pack subjects. Two templates writing the same path differently is an error.
  - `generateProject({ dir, design, projectName, vendor?, git? })` (`src/generate.ts`):
    - Checks ownership first and writes nothing if there's a problem. A file in the previous lock whose hash no longer matches is `edited`; a file Jeeves would generate that exists with other contents and isn't in the lock is `unmanaged`. A deleted generated-owned file is simply generated again.
    - Vendors runtimes with `pnpm pack` into a scratch folder and copies each tarball only if its bytes changed. `pnpm pack` is deterministic (checked: identical SHA-256 across runs), so an unchanged runtime doesn't touch the project.
    - Writes generated-owned files whose contents changed, and scaffold files only when missing. It merges missing dependencies and scripts into project-owned `package.json` files (`mergePackageDependencies`/`mergePackageScripts`), and writes `jeeves/lock.json`.
    - Reports `written`, `scaffolded`, `kept`, `packages`, `vendored`, `removedElements` (in the old lock, not the design; left in place), and `orphaned` (generated before, not now; left in place).
    - `git init --initial-branch=main` plus one commit when the folder isn't inside a work tree. It uses the person's git identity, or `Jeeves <jeeves@localhost>` when there's none.
  - `jeeves/lock.json` (`src/lock.ts`, Zod-validated): `lockVersion`, `generator`, `designRevision`, `templates`, `runtimes` (name, version, tarball path), `elements` (id, template, dir, ownedPaths), and `files` (generated-owned path → `sha256-…`). It has no timestamps.
  - `builtinModules()`/`templateSet()` (`src/modules.ts`) give the five `TemplateModule`s and a manifest lookup.
  - **Baseline** (`@jeeves/generator/baseline`):
    - `runBaseline({ dir, design, subjects, onEvent, signal, keepRunning })` runs `pnpm install`, `pnpm -r --no-bail typecheck`, `docker compose up --build --wait --wait-timeout 300`, every template test pack, then `docker compose down` (volumes kept). Down runs even after a failure or a cancel.
    - Packs run in the order web-app, rest-api-client, rest-api-server, postgres, http-service (S9's advice).
    - It streams `step`, `log` and `check` events. When `up` fails, it logs container states and the last 40 lines of each failing service.
    - `ComposeCli` is the compose-CLI `TestPackContext` S7 asked for. `endpoint` uses `docker compose port`, `exec` uses `exec --no-TTY`, `restart`/`start` wait for the health check through `docker inspect`, `stop` returns the exit code, and `run` uses `run --rm --no-deps --no-TTY`. It uses compose's default project name (the folder name), the same one a person gets with `docker compose up` there.
  - Tests:
    - `src/plan.test.ts`: 40 golden files in `packages/generator/golden/link-shortener/` (every planned file plus the lock) via `toMatchFileSnapshot`, a determinism check, ownership, owned paths, subjects, and notes contents. Run `pnpm vitest run --project generator -u` after a deliberate change. Biome ignores `packages/generator/golden/**`.
    - `src/generate.test.ts`: byte-identical output in two folders, a rerun changes nothing, the lock, dependencies, regeneration after adding an element, a hand-edited file blocking with nothing written, an unmanaged file, a deleted file regenerated, a removed element reported, and git (once, and not inside a parent repository).
    - `conformance/baseline.conformance.ts` (in `pnpm test:templates`) runs the real fixture end to end.
- **Server:**
  - Migration `0002_generate`: `projects.output_dir` and a `generations` table (status, steps, checks, log capped at 3000 lines, report, error).
  - `GenerationService` (`src/generate/service.ts`) runs one generation per project at a time as an in-process background job:
    - It refuses an empty design (`DESIGN_EMPTY`), error-level findings (`DESIGN_NOT_READY`), and a relative folder (`INVALID_OUTPUT_DIR`; `~` is expanded).
    - It saves the chosen folder on the project and persists progress every second and at the end.
    - Cancel aborts it. Restarting the server marks a running generation `interrupted` (`failInterruptedGenerations` in `main.ts`).
    - The generator is injectable (`AppDeps.generator`), as are default folders (`AppDeps.projectsDir`; `JEEVES_PROJECTS_DIR`, else `~/jeeves-projects/<slug>`).
  - Routes (`src/routes/generate.ts`):
    - `GET /projects/:id/generation`
    - `POST /projects/:id/generations` (202)
    - `GET /projects/:id/generations/:gid`
    - `GET …/:gid/events`: NDJSON with a `snapshot`, live `step`/`log`/`check` events, then `done`; a finished generation gets its snapshot and `done` right away
    - `POST …/:gid/cancel`
  - Status values: `succeeded`, `failed` (an exception or a red baseline), `blocked` (ownership problems), `cancelled`, `interrupted`.
- **Web:**
  - A yellow **Generate** button at the top right of the board.
  - The output drawer along the board's bottom (`src/generate/`):
    - Output folder input (prefilled with the saved folder or the default) and a "Run the baseline check" checkbox.
    - Generate / Generate again / Cancel. Generating is disabled, with the reason and a "Show findings" button, when the design is empty or has errors.
    - Status: "Green" only when the baseline ran and passed; "Written, baseline not run" otherwise.
    - The step list with durations, test-pack results (with errors), and what was written (collapsible file lists; removed elements; ownership problems).
    - The streamed log, which auto-scrolls unless you scroll up.
    
    It reconnects to a running generation after a reload. Everything works by mouse.
- `apps/web/e2e/generate.spec.ts`. Playwright sets `JEEVES_PROJECTS_DIR` to a temp folder.
- README: a Generate section; PLAN progress line.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 326 files in 69ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  48 passed (48)
      Tests  352 passed (352)
```

Generator baseline, `pnpm vitest run --config vitest.templates.config.ts packages/generator --reporter verbose` (Docker 29.9.1):

```text
 ✓ generator baseline: the link-shortener fixture > generates a project whose baseline is green 54424ms
 ✓ generator baseline: the link-shortener fixture > stays green after adding an element, with project-owned edits kept 94411ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  150.06s
```

Before writing that test, I ran the same baseline by hand on the fixture and watched each step. The output (abridged):

```text
STEP install passed · typecheck passed · compose-up passed 5929ms
CHECK web page-loads / client-routes / runtime-config / sample-call            passed
CHECK web/web-links-client types / call / timeout (5216ms)                     passed
CHECK links/links-api openapi-served / handlers / contract-smoke / invalid-requests passed
CHECK links-db healthy / consumer-own-database / consumer-isolation / migrations-applied / survives-restart passed
CHECK links health / ready (3758ms) / config-validation / graceful-shutdown (7876ms) passed
STEP test-packs passed 27026ms "20 checks passed" · compose-down passed
```

A cold `docker compose up --build --wait` of the fixture took 54 s. `pnpm install` in a generated project takes under 1 s with a warm store, and the type check takes 0.3 s.

`pnpm test:e2e`: 14 passed (12 earlier plus 2 new).

I didn't rerun the template conformance suites (`templates/*/conformance`). No template code changed in this section; only `vitest.templates.config.ts` gained the generator's include.

How the "Done when" items are covered:

- **Deterministic output:** golden files plus the plan determinism test, and two folders compared byte for byte with a no-op rerun (`generate.test.ts`).
- **Fixture baseline green:** `baseline.conformance.ts`, first test.
- **Regeneration after adding an element keeps project-owned files:** unit test (a feature file, the contract, and `package.json` edits, including a changed version, survive), and the second conformance test (a new `stats` service on the same database; the edited feature is kept; still green).
- **Hand-edited generated-owned file:** a unit test (blocked, the folder snapshot unchanged, no `frontends/admin`), the API test (`blocked` status with `problems`), and e2e (the drawer shows "Stopped" and the file's message).

### Deviations and choices the plan left open

- **Generation runs as an in-process job, not pg-boss.** §15 puts pg-boss setup in S11. The job's state is in the `generations` table, and a restart marks it `interrupted` (the same recovery as chat turns). S11 can move it onto pg-boss if it wants one queue.
- **Test packs run from Jeeves, not from `tests/e2e/` inside the project.** The packs are TypeScript in this repo and use Jeeves's Playwright. Copying them into each project would mean shipping the harness too. `tests/e2e/` is scaffolded for project-owned tests, with a README saying so. The orchestrator (S12) should call `runBaseline` (or its pieces) for "every test pack".
- **The baseline doesn't run project tests** (`pnpm test`). §9 lists install, type check, compose and test packs; the orchestrator's checks (§10) add project tests.
- **Runtime distribution:** vendored `pnpm pack` tarballs, as §16 assumed. The lock records name, version and tarball path but not a tarball hash. Tarballs are Jeeves-owned and replaced when their bytes change.
- **`package.json` and `pnpm-workspace.yaml` at the root are scaffolds** (project-owned), not generated, so agents can add scripts or workspace settings. Element `package.json` files get missing dependencies merged as in S8/S9.
- **The git commit happens before the baseline**, so `pnpm-lock.yaml` (created by `pnpm install`) is left uncommitted. The orchestrator commits it with the first task. `src/clients/*.openapi.ts` is git-ignored because each `pretypecheck` regenerates it.
- **Generated projects get `name` from the Jeeves project name** (slugged) for the root `package.json` and the default folder. Compose uses the folder name as its project name.
- **`docker compose down` after the baseline** (volumes kept), so generating doesn't leave the app running. `runBaseline({ keepRunning: true })` exists; the UI doesn't offer it yet.
- **An empty design can't be generated** (`DESIGN_EMPTY`). §6 only requires no error findings, but an empty project is never what someone means.
- **The drawer's primary button uses `color="cyan.9"`.** Axe flagged the theme's default filled cyan (white on `#15aabf`, 2.78:1). The chat's Send button (S6) uses the same default and would fail the same check when enabled. I left it alone; it's a small fix for whoever touches the theme.

### Known issues

- **pnpm resolution:**
  - The generator finds pnpm through `npm_execpath`, which is set when Jeeves is started with `pnpm dev`/`pnpm start`. Otherwise it uses `JEEVES_PNPM`, then `pnpm` on PATH.
  - The generated root `package.json` scripts (`pnpm typecheck`) call `pnpm` by name, so a machine where pnpm is only reachable as `corepack pnpm` needs `corepack enable` to use them. The baseline itself doesn't go through those scripts.
- **Chromium on the host:** web-app and rest-api-client packs launch Playwright's Chromium on the host. Without its system libraries those checks fail with Playwright's own message (see the README's `install-deps` note).
- **No cross-project port or name clashes are checked.** Two Jeeves projects writing into folders with the same base name share a compose project name.
- **`orphaned` generated files keep their old contents**, and they're dropped from the lock, so they become project-owned. That's the "never delete" rule; the drawer lists them.
- **Generation log lines are capped at 3000** (Docker builds are chatty). The full output isn't kept anywhere else.
- **Cancelling during `pnpm install` or `docker compose up` kills that command.** `compose down` still runs, but a half-built image may stay in Docker's cache.

### For S11 and later

- **Planning input:**
  - `jeeves/lock.json` `elements[]` has each element's `template`, `dir` and `ownedPaths`. Use `ownedPaths` for §10's "task stays within one element's owned paths", and `readLock(dir)` to read it.
  - `jeeves/elements/<id>.md` has the notes and guides.
  - The dependency order for the seed can come from `design.json`'s connections, plus element kinds via the templates.
- **"Is the project green?":**
  - `runBaseline({ dir, design, subjects, onEvent, signal })`. `subjects` comes from `planProject(design, templateSet(), …).subjects`; planning is cheap and needs no disk.
  - To get only the checks, the steps are separate; split `runBaseline` if a task needs just "typecheck + packs" without reinstalling.
- **Regenerate before orchestrating** a changed design. `generateProject` refuses to overwrite hand edits; agents must never edit generated-owned files (the generated `AGENTS.md` says so).
- **The `GenerationService` pattern** (in-memory live state plus periodic saves, an NDJSON follow endpoint, `interrupted` on restart) is a template for run events if pg-boss doesn't cover streaming.

---

## S11: Orchestrator, part 1 (planning and run state) (2026-10-29)

### Built

- **`@jeeves/orchestrator`** (`packages/orchestrator`, pure apart from reading the project folder):
  - `states.ts`: run statuses (PLAN §10's eight plus `planning`), task statuses (`pending`, `running`, `done`, `needs-attention`, `cancelled`), attempt statuses (`running`, `succeeded`, `failed`, `interrupted`, `cancelled`). `allows(status, action)` and `runActions(status)` are the one table of which action (start, pause, resume, cancel, replan, edit) each state allows.
  - `seed.ts`: `seedPlan({ design, lock, templates })` makes one task per element and per attachment whose notes aren't empty.
    - **Order:** `elementOrder` is a topological sort over every connection (`uses-database`, `calls`, `depends-on`; from depends on to). Ties break by element kind (database, then library/external, service, worker, frontend), then by document order. A cycle is broken at the lowest-ranked element.
    - **Within an element**, attachment tasks come before the element's own task: an API or client before the features that use it.
    - **Each task** carries `key` (`links`, `links.links-api`, and `-2`, `-3` for splits), `ownedPaths` (from `lock.json`), and `dependsOn` (element IDs). Seed titles are `Implement <element name>` and `Implement <attachment template> (<id>) on <element name>`.
    - `orderProblems(tasks)` reports a task placed before a task of an element it depends on. It's a warning, not an error.
  - `planner.ts`: `refinePlan(provider, model, input, signal)`.
    - The model gets the seed plan and the element briefs (`jeeves/elements/<id>.md`, truncated at 12k characters each) and must call `submitPlan`, whose arguments are validated with Zod: 1–40 tasks, each with 1–10 acceptance tests.
    - `checkSubmittedPlan` accepts only seed targets, requires every seed target to be covered, puts the tasks back in seed order (keeping the model's order within a target), and copies `ownedPaths` and `dependsOn` from the seed. So **the model can't widen a task's paths or reorder dependencies**.
    - An invalid plan, or an answer without the tool call, is sent back with the errors, up to 3 model calls. A `ProviderError` is thrown to the caller.
  - `project.ts`: `readGeneratedProject(dir)` returns the lock, the design snapshot, and the briefs, with clear errors.
  - `execute.ts`: the **S12 seam**. `TaskExecutor.execute({ runId, dir, task, attempt, signal })` returns `{ status, summary, usage, error? }`. `stubExecutor(delayMs)` waits, then reports success with `STUB_SUMMARY` and unknown usage. It rejects on abort.
- **Server:**
  - Migration `0003_orchestrator`, with three tables: `runs` (status, `status_reason`, `output_dir`, `design_revision` from the lock, `planner` JSON with mode/model/message/usage, `warnings`, timestamps), `tasks` (position, key, element, attachment, title, description, acceptance, owned paths, depends-on, source, `edited`, status), and `attempts` (number, status, summary, usage, error).
  - **pg-boss 12.35.1** (`src/runs/jobs.ts`):
    - `pgBossJobs(options)` creates the queues `jeeves-run-plan` and `jeeves-run-step` with `retryLimit: 0`, a 6 h expiry, 0.5 s polling, and local concurrency 4. `main.ts` starts it on `DATABASE_URL`, so pg-boss's tables live in the `pgboss` schema of Jeeves's database.
    - `localJobs()` is the in-process default for API tests.
    - The JobQueue interface keeps pg-boss out of `RunService`.
  - `RunService` (`src/runs/service.ts`):
    - `create` refuses a project with no `lock.json` at its output folder (`PROJECT_NOT_GENERATED`) and a second active run (`RUN_ACTIVE`). It inserts a `planning` run and queues the plan job.
    - The plan job seeds, then refines with the `planner` role's model.
      - **Falling back to the seed** happens when there's no key, the planner never gives a valid plan, or the provider fails (the message says which, and for `auth`/`quota` it says to fix Settings and press Plan again). The planner's usage is recorded.
      - **Warnings** are recorded when the design changed after generation (`lock.designRevision` ≠ the current revision) and when the latest generation into that folder wasn't green with the baseline.
      - An unreadable project fails the run.
    - Edits (`editTask`, `removeTask`, `reorder`) work only on pending tasks, and only when the run is planned or stopped (`paused`, `needs-attention`, `waiting_for_provider`).
    - `act`: start, pause, resume, cancel, replan.
      - Each transition is a conditional update on the current status, so racing requests can't both win.
      - Cancel marks pending tasks cancelled and aborts planning or the task in progress.
    - The step job runs the first pending task: claim the task, insert an attempt, then call the executor.
      - Success marks the task done. A failed attempt (or an executor error) marks the task and the run `needs-attention` with a reason. An aborted attempt is `cancelled`.
      - Then, if the run is still running, it queues the next step. No pending task left means `succeeded`.
      - An in-memory per-run guard makes duplicate jobs no-ops.
    - `get` returns the run, its tasks with attempts, `actions`, `editable`, `orderProblems`, and usage (planner, attempts, and total; unknown stays unknown).
  - **Restart recovery:** `recoverRuns(db)` (in `main.ts` before pg-boss starts) marks running attempts `interrupted` and puts their tasks back to `pending` (the workspace is untouched). Running runs become `paused` with "Jeeves restarted while this run was running. Press Resume to continue." `requeuePlanning(db, jobs)` (after listen) queues planning again for runs left in `planning`.
  - Routes (`src/routes/runs.ts`):
    - `GET|POST /projects/:id/runs`
    - `GET /projects/:id/runs/:runId`
    - `PATCH|DELETE …/tasks/:taskId`
    - `PUT …/order` (`{ taskIds }`: exactly the pending tasks)
    - `POST …/{start,pause,resume,cancel,replan}`
  - `AppDeps` gained `jobs` and `executor`. `main.ts` uses `stubExecutor(JEEVES_STUB_TASK_MS ?? 1500)`.
- **Web: the Runs view** (`apps/web/src/runs/`):
  - **Left column:** **Plan a run** (disabled, with the reason, until the project is generated or while a run is active) and the run list (status badge, done/total tasks, date).
  - **Run header:** status and the allowed actions: **Start**, **Resume**, **Pause**, **Plan again**, and **Cancel run** (with an inline "Yes, cancel run / Keep it" confirmation). Below it: the status reason, warnings, and how the plan was made (refined by which model, or seed and why) with token usage.
  - **Task cards:** number, title, element (and attachment), status, an "edited" tag, description, acceptance tests, the owned paths ("May change: …"), order warnings, and attempts.
    - While the run is editable, each pending task has Move up, Move down, Edit (an inline form: title, description, acceptance tests one per line), and Remove (with an inline confirmation).
  - It polls every second while the run is planning or a task is running. If the app starts on `#/runs`, it opens the project itself.
  - The unused `shell/EmptyView.tsx` is removed.
- **Fixtures:** `fixtures/chat/e2e-script.json` has a first turn, `Refine the seed plan`, that answers the planner for the link-shortener fixture (it splits the Links service). `playwright.config.ts` sets `JEEVES_STUB_TASK_MS=2000`.
- README (Runs section, status, layout) and the PLAN progress line.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 346 files in 138ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  53 passed (53)
      Tests  384 passed (384)
```

The S11 tests (`pnpm vitest run packages/orchestrator apps/server/src/routes/runs.test.ts apps/web/src/runs --reporter verbose`): 32 passed across 5 files. 15 are orchestrator tests (seed order, cycles, planner validation, retries, provider errors), 12 are API tests, and 5 are web tests. The API tests:

```text
✓ planning > can't plan a project that hasn't been generated
✓ planning > plans a generated fixture project with the planner into dependency-ordered tasks
✓ planning > falls back to the seed, in dependency order, when no planner model is set up
✓ planning > uses the seed and says why when the provider is out of quota
✓ planning > warns when the design changed after generation, and allows one active run
✓ editing the plan > edits, removes, and reorders pending tasks, and the changes persist
✓ running (stub execution) > marks every task done in order, records attempts, and succeeds
✓ running (stub execution) > pauses between tasks, refuses edits while running, and resumes
✓ running (stub execution) > cancel stops the task in progress and the rest of the plan
✓ running (stub execution) > a failed attempt stops the run as needs-attention
✓ restarts > a run survives a server restart: the attempt is interrupted and the run resumes
✓ restarts > planning interrupted by a restart is planned again on start
```

The API tests generate the real fixture project (`generateProject` without `pnpm pack` or git) into a temp folder and plan it. The restart test uses **real pg-boss on PGlite** (`fromPglite`, PGlite persisted in a temp folder). It drops the first "process" mid-task (`stop({ graceful: false })` with the attempt still hanging), reopens the database, runs `recoverRuns`, and resumes. The planned order for the fixture is `links.links-api`, `links`, `web`. `links-db` and `web-links-client` have no notes, so they get no tasks.

`pnpm test:e2e`:

- First full run: 15 passed, 1 failed. The failure was `chat.spec.ts` › "settings show key status and save models per role": "Save models" was still disabled after `fill`.
- That spec alone: 4 of 4 passed. The next full run: 16 of 16 passed, including the new `runs.spec.ts` (2 tests, ~18 s).
- S11 doesn't touch Settings, so this looks like the same kind of load-dependent flake S9 saw in `chat.spec.ts`.

`runs.spec.ts`, all by mouse:

- **Planning:** plan the generated fixture; check the planner's four tasks, the baseline warning, and the acceptance tests.
- **Editing:** edit a task's title and acceptance tests; move tasks up and down (and see the dependency warning); remove one with confirmation. A reload shows the same plan.
- **axe:** no violations on the Runs panel.
- **Running:** Start; Pause while the first task runs; the first task finishes and the rest stay "To do" 2.5 s later. Resume runs to Succeeded with one succeeded attempt per task.
- **Cancel:** plan a second run, then Cancel (with confirmation).
- **Second test:** an ungenerated project explains why it can't be planned.

**A real restart, by hand**, against Docker Postgres with real pg-boss (scratch script: start the server with `node --import tsx src/main.ts` on port 4320, generate and plan the fixture, start, SIGKILL during the second task, start again, resume):

```text
before SIGKILL: status running; links.links-api: done [succeeded], links: running [running], links-2: pending, web: pending
after restart:  status paused, "Jeeves restarted while this run was running. Press Resume to continue."
                links.links-api: done [succeeded], links: pending [interrupted], links-2: pending, web: pending
resumed: running
finished: succeeded; links: done [interrupted, succeeded], every other task done [succeeded]
```

(Kill the server process itself: the `tsx` CLI forks, so SIGKILL on `tsx` leaves the real server running.)

I didn't run the planner against real OpenAI: S11's "Done when" uses the fake provider, and this machine has no key configured.

### Deviations and choices the plan left open

- **A `planning` run state** (not in §10's list). Planning calls a model and can take a while, so the run exists and shows progress first. A restart re-queues planning.
- **After a restart, running runs are paused, not resumed automatically.** §10 says the attempt is interrupted and "Resume starts a new attempt". I made Resume the person's decision, so a crashed coding agent isn't restarted unattended. S12 adds the diff summary to the new attempt's brief. The interrupted attempt's workspace is left as it is.
- **Pause takes effect between tasks** ("Paused. A task in progress finishes first."). Cancel aborts the task in progress through the executor's `AbortSignal`.
- **Planner problems fall back to the seed** instead of moving the run to `waiting_for_provider`. A seed plan is still useful. The run shows why, and **Plan again** retries. `waiting_for_provider` is in the state table for S12's coding-agent failures.
- **The planner can't change owned paths, dependencies, or the dependency order**: tasks are re-sorted into seed order and take their paths from the lock. It can only split, retitle, describe, and add acceptance tests, and it must cover every seed task.
- **The person can reorder freely.** A task moved ahead of something it depends on gets a warning (`orderProblems`), not a refusal.
- **Attachment tasks share their element's owned paths.** The lock has owned paths per element, and attachments live in the element's folder; the contract file is in the element's owned paths.
- **Generation is still an in-process job**, not pg-boss (S10's choice). Only runs use pg-boss.
- **The Runs view polls** (1 s while live) instead of streaming. Run state is all in the database, so polling survives restarts without reconnect logic. S12's live agent events may want an NDJSON stream like Generate's.
- **One active run per project** (any run that isn't cancelled, failed, or succeeded).

### Known issues

- **Generate isn't blocked while a run is active**, and a run doesn't notice a regeneration under it. S12 should refuse Generate (or at least warn) while a run for that folder is running or paused.
- **pg-boss jobs stay "active" after a crash** until their 6 h expiry. That's harmless, since run state lives in Jeeves's tables and recovery doesn't depend on pg-boss's job state, but they appear in pg-boss's own tables.
- **The per-run "busy" guard is in memory**, which is right for one Jeeves process. Two server processes on one database would need a database lock (pg-boss's `singleton`/`stately` policy, or `SELECT … FOR UPDATE`).
- **The stub reports unknown usage**, so a run's total shows "unknown" once a task has run.
- **The planner's message is the whole seed plus all briefs.** Very large designs could hit context limits; briefs are truncated at 12k characters each, but there's no overall cap.
- **`chat.spec.ts`'s settings test flaked once under load** (see above).

### For S12

- **Swap in the real executor:** pass `executor` in `main.ts` (`AppDeps.executor`).
  - `AttemptInput` has the run, the folder, the task (with `ownedPaths`, `acceptance`, `dependsOn`, `description`), the attempt number, and an abort signal.
  - Return `failed` with `error` for a red check. The service already turns that into `needs-attention`.
  - Retries (default 2) belong in the executor or in `runTask`; today one failure stops the run.
  - Throwing a `ProviderError` with `blocksProvider` should become `waiting_for_provider` (not wired yet; `runTask` treats every throw as `needs-attention`).
- **Attempt `number` > 1 after an `interrupted` attempt** is the resume case: brief the agent with the existing diff.
- **The planner model** comes from `models("planner")`; the coding model is the `coding` role in Settings.
- **Running the project's checks:** `@jeeves/generator/baseline` (`runBaseline`, or its steps) and the lock's `ownedPaths` for the diff check.
- **Git:** generation leaves `pnpm-lock.yaml` uncommitted (S10). Commit it with the first task.

---

## S12: Orchestrator, part 2 (execution and git strategies) (2026-10-29)

### Built

New dependency, pinned: `@openai/codex-sdk` 0.162.1 (providers; released 2026-10-09). It brings the matching `@openai/codex` CLI binary.

- **`packages/providers`**
  - `coding.ts`: the provider-neutral `CodingAgentProvider` interface. `run({ workingDirectory, prompt, model?, resumeSessionId? }, { signal, onEvent })` runs one session (or one more turn of a resumed one) and returns `{ sessionId, finalMessage, usage }`. Aborting the signal interrupts it. Events are `session`, `message`, `reasoning`, `command`, `files`, `todo`, and `warning`. Capabilities: `resume`, `usage`, `streaming`. Provider problems are thrown as `ProviderError` (the S6 kinds), so `blocksProvider` (auth or quota) works the same as for models.
  - `codex.ts`: the Codex adapter, on the SDK's `startThread`/`resumeThread` + `runStreamed`. Sessions use `sandboxMode: "workspace-write"` (writes are limited to the project folder), `approvalPolicy: "never"`, `networkAccessEnabled: true` (for `pnpm install`), and `skipGitRepoCheck`. It maps JSONL items to events, with file paths made relative to the project, and maps `turn.completed` usage. `codexError` sorts Codex's text errors into kinds (401/login → auth, usage limit/quota → quota, 429 → rate-limit, spawn/5xx/disconnects → unavailable). The SDK is injectable (`CodexLike`) so tests replay recorded events.
  - `fake-coding.ts`: `createFakeCodingAgent(script)`. Steps can `write`, `append`, `remove`, or `writePrompt` (write the prompt into a file), set a `message`, `usage`, `delayMs`, `error` (a `ProviderError` kind), or `hang` (apply edits, then wait until interrupted, like a killed agent). `codingScriptByTask(json)` is a stateless script keyed by task key and attempt number. Every orchestrator prompt starts with `Jeeves task: <key>, attempt <n>` (`TASK_MARKER`), which is how it picks.
- **`packages/orchestrator`**
  - `execute.ts`: `AttemptInput` gained `strategy`, `previous` (how the last attempt ended, with its feedback and session), the task's `workspace`, `saveWorkspace`/`saveSession` callbacks, and `onEvent` (live log). `AttemptOutcome` gained `feedback`, `sessionId`, `checks`, `changes`, `diff`, and `commit`. `gitStrategies` = `direct`, `branch-per-task`. New sub-path exports `@jeeves/orchestrator/states` and `/execute`, because drizzle-kit (CommonJS) can't load the ESM-only Codex SDK through the package index.
  - `git.ts` (`Git`):
    - **Repository:** `git init` plus a commit if the folder isn't a repository. A project folder inside another repository is refused.
    - **Run branch:** each run works on `jeeves/run-<id>`, made from whatever was checked out. Uncommitted changes found then (such as `pnpm-lock.yaml` from Generate's install) are committed first as "Jeeves: uncommitted project changes before run N".
    - **Strategies:** `branch-per-task` uses `jeeves/run-<id>-<task key>` (`checkout -B`) and merges it into the run branch with `--no-ff` after the checks pass. `direct` commits on the run branch.
    - **Diffs and reverts:** `changes(base)` and `diff(base)` (capped at 200k characters) work against the task's base commit, after `git add --all` (so `.gitignore` applies, and commits the agent made itself are included). `restore(base, paths)` reverts rejected files.
    - **Commits:** the person's git identity, or `Jeeves <jeeves@localhost>`. Nothing is ever pushed.
  - `brief.ts`: `taskBrief` contains the marker line, the task and description, acceptance tests, the owned paths (plus `pnpm-lock.yaml`), the rejection rule, the checks Jeeves runs, "don't commit or switch branches", the element's `jeeves/elements/<id>.md` (notes and template guide), the contracts of connected elements (read-only), `AGENTS.md`, and, on a resume, an "Earlier work on this task" section with the diff stat and diff. `followUpPrompt` is the retry message: the check failure and the end of the check output.
  - `checks.ts`:
    - `projectChecks()` runs `runBaseline` with the new `unitTests: true`. That is install, type check, **`pnpm -r --no-bail test`** (a new `unit-tests` step, `taskCheckSteps`), `docker compose up --build --wait`, every template test pack, and `compose down`. It maps baseline events to the attempt log.
    - `markerChecks(delayMs)` is for tests: one "project tests" check that fails when a changed file contains `JEEVES_FAKE_CHECK_FAIL`.
  - `agent.ts` `createAgentExecutor({ agents, checks })` handles one attempt:
    1. Get the agent and model from the `CodingAgentSource` (an error becomes an `auth` `ProviderError`).
    2. Prepare git, then save the workspace (branch and base commit) before the agent starts.
    3. Brief the agent:
       - A retry after failed checks **resumes the same session** with `followUpPrompt`.
       - Anything else (first attempt, after a restart, after an agent crash) starts a new session with the full brief. When there's earlier work it gets "Earlier work" and the last failure.
    4. Run the session, streaming its events.
    5. **Owned-path check:** changed files outside `ownedPaths` + `pnpm-lock.yaml`, and any generated-owned file (in `lock.files`), are reverted to the base. The attempt fails with the list, and the feedback tells the agent which paths it may change. The other checks don't run.
    6. No changes at all fails the attempt.
    7. Run the project checks. On failure the feedback is the failed steps and checks plus the last 80 log lines.
    8. On success, commit and merge per the strategy.

    Quota and auth errors are thrown, so the run waits for the provider. Other agent errors (a crash, a disconnect) fail the attempt and keep the diff.
- **Server**
  - Migration `0004_execution`:
    - `projects`: `git_strategy` (default `branch-per-task`) and `max_retries` (default 2).
    - `runs`: the same two, copied from the project when the run is created.
    - `tasks`: `workspace` (JSON) and `commit`.
    - `attempts`: `session_id`, `feedback`, `checks`, `changes`, `diff`, `events` (the live log, capped at 3000 events and 4000 characters each), and `commit`.
  - `RunService`:
    - `runTask` loops attempts until one succeeds. A failed attempt is retried (with its feedback) up to the run's `maxRetries`. Then the task and run are `needs-attention`, and the status reason is the first line of the error.
    - Each attempt saves its live log every second (`attemptDetail` serves the in-memory log while it runs).
    - A thrown `ProviderError` with `blocksProvider` puts the task back to pending and the run in `waiting_for_provider` ("…Fix it (Settings, or `codex login`), then press Resume."). Any other thrown error (git, an unreadable project) is `needs-attention` without retries.
    - **Resume puts `needs-attention` tasks back to pending** first. Before this, S11's Resume skipped a failed task and went on to the next one, which the new e2e test caught.
    - Attempts in the run detail leave out `events`, `diff`, and `feedback`. They're in `GET /projects/:id/runs/:runId/attempts/:attemptId`.
    - `GET|PUT /projects/:id/run-settings` (`{ gitStrategy, maxRetries }`, retries 0–5) apply to runs planned afterwards.
  - **Generate is refused** (409 `RUN_ACTIVE`) while a run of the project is running, paused, needs attention, or waiting for a provider (S11's known issue).
  - `src/runs/agents.ts`: `codexAgents(settings, JEEVES_CODEX_PATH)` uses the `coding` role's model from Settings. `fakeCodingAgents(path)` is the fake, used when `JEEVES_FAKE_CODING_SCRIPT` is set.
  - `main.ts` uses `createAgentExecutor` with `projectChecks()`, or `markerChecks` when `JEEVES_FAKE_CHECKS` is set (its value is a delay in ms). `JEEVES_STUB_EXECUTOR=1` still gives S11's stub.
  - `ensureDatabase(url)` creates the server's database if it's missing (see Deviations).
- **Web (Runs view)**
  - Sidebar **For new runs**: Git strategy and "Retries after a failed attempt" (native selects; they save on change).
  - The run header shows the strategy, the retry limit, and where the work goes (`jeeves/run-<id>` in the folder).
  - Each attempt row toggles its **details**. It opens by itself while running. The details (`AttemptDetails.tsx`) have three tabs:
    - **Log**: the agent's messages, commands, file edits, plan, and Jeeves's git and check lines. It's polled every second while running and auto-scrolls unless you scroll up.
    - **Checks**: the owned-path result, steps, and test-pack checks.
    - **Changes**: the changed files, the colored diff, and the commit.
  - Attempt rows show token usage. Done tasks show their commit. Resume is enabled when a task needs attention.
  - Run and task badges use shade 9 colors: axe flagged S11's orange "Needs attention" badge (3.61:1) once a run could reach that state in e2e.
- `fixtures/coding/e2e-script.json` (+ README) holds the e2e coding script. `playwright.config.ts` sets `JEEVES_FAKE_CODING_SCRIPT`, `JEEVES_FAKE_CHECKS=300`, and its own `DATABASE_URL` (`jeeves_e2e`).
- README (Runs: execution, git, Codex login; Test) and the PLAN progress line.

### Commands and results

`pnpm check`:

```text
$ biome check .
Checked 358 files in 86ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  55 passed (55)
      Tests  404 passed (404)
```

The new tests:

- `packages/orchestrator/src/agent.test.ts` (7): real generated fixture projects and real git, with the fake agent and marker checks.
  - `direct` commits (the lockfile is committed first), and the brief's contents, including a neighbour's contract in the `web` brief.
  - `branch-per-task` merges.
  - A red check, then a retry that resumes the session with the check output.
  - Outside-path and generated-owned changes are rejected and reverted.
  - An agent that changes nothing fails the attempt.
  - An interrupted session, then a new session briefed with the earlier diff.
  - Quota and auth errors are thrown; other errors fail the attempt.
- `packages/providers/src/codex.test.ts` (5): Codex event mapping, usage, the sandbox options, resume, error kinds, the fake agent, and `codingScriptByTask`.
- `apps/server/src/routes/runs.test.ts`:
  - The S11 "failed attempt" test now covers retries (3 attempts, then needs-attention).
  - Six new tests under "executing with the fake coding agent":

```text
✓ runs every task, checks it, and merges each task branch into the run branch
✓ direct: commits each task on the run branch
✓ a failing task is retried with the check output, then pauses as needs-attention
✓ rejects and reverts a change outside the task's owned paths
✓ a provider out of quota moves the run to waiting_for_provider; Resume tries again
✓ killing the server mid-task leads to a correct resume
```

  The restart test uses real pg-boss on PGlite. The fake agent writes half the feature and hangs. The first "process" is dropped (`stop({ graceful: false })`), `recoverRuns` runs on the reopened database, and the run comes back `paused` with the attempt `interrupted` and the work still on the task branch. Resume starts a **new** session whose brief has "Earlier work on this task" with the diff, and the commit holds both halves.
- `apps/web/src/runs/RunsView.test.tsx`: two new tests (saving run settings; an attempt's log, checks, changed files, and diff, with Resume enabled for a task needing attention).

`pnpm test:e2e`: **17 passed** (24.7 s). `runs.spec.ts` has a new test, by mouse: set retries to 0 and the strategy to direct, plan, then put the fail marker in a task's description. Start; the running attempt opens by itself with its live log. The run reaches Needs attention, with the Checks tab showing "Unit and project tests: failed" and owned paths OK, and the Changes tab showing the file and diff. Axe reports no violations. Resume runs attempt 2 (the follow-up prompt, without the marker), and the run succeeds with a commit. The S11 test now runs on the fake agent too (Pause during the first task, Resume to the end).

**Manual run with real Codex on the fixture project.** This went through the real server (`JEEVES_SERVER_PORT=4320`, scratch `JEEVES_HOME` and projects folder, no OpenAI key so the plan is the seed). The coding model was set to `gpt-6-astra` (this machine's Codex default; Codex is logged in with ChatGPT). A small script drove the API.

```text
16:48:45 project created, link-shortener design applied, coding model = gpt-6-astra
16:49:48 generation succeeded: generate, install, typecheck, compose-up, test-packs, compose-down all passed
16:49:49 planned (seed, no planner key): links.links-api, links, web; strategy branch-per-task, 2 retries
16:49:49 start
16:55:32 links.links-api done, attempt 1 (5m43s): 1,087,400 in / 9,052 out tokens
         changed: contracts/links.openapi.yaml, services/links/{migrations/*, src/db/schema.ts,
         src/features/links/{index,store}.ts, test/links.test.ts, test/README.md}
         Jeeves's checks: install, typecheck, unit-tests (3.1 s), compose-up, test-packs (20/20), compose-down all passed
16:59:08 links done, attempt 1 (3m36s): 758,821 / 5,384; it found the API task had already done the
         redirect and click counting, and added 3 regression tests (services/links/test/links.test.ts)
17:07:40 web done, attempt 1 (8m32s): 1,306,998 / 18,903; frontends/web/{package.json, src/App.tsx,
         src/pages/{Home.tsx,recentLinks.ts}, src/styles.css, test/Home.test.tsx}, pnpm-lock.yaml
run succeeded; total 3,153,219 in / 33,339 out tokens (cost unknown)
```

The project's git history after the run (`jeeves/run-21`, `main` untouched):

```text
*   e838641 Merge jeeves/run-21-web
| * dbfdea2 web: Implement Web app
*   5829ea5 Merge jeeves/run-21-links
| * a712989 links: Implement Links service
*   b0bd006 Merge jeeves/run-21-links.links-api
| * 6baa205 links.links-api: Implement REST API server (links-api) on Links service
* 2ecfc22 Jeeves: uncommitted project changes before run 21
* 64b2f3c Generate template project from design revision 1
```

Observations from the real run:

- Codex reads outside the project: it read Jeeves's own repo (`/home/ash/github/jeeves/packages/generator/...`) to learn how the checks work. The workspace-write sandbox limits writes, not reads.
- One summary says "Docker required a temporary configuration workaround": Codex worked around Docker inside its sandbox to run `docker compose` itself. Jeeves's own checks run outside the sandbox and passed.
- Because the seed plan has no splits, the `links.links-api` task implemented the whole Links service, and the `links` task found little left to do.

**Found while testing:** my scratch server and the e2e server shared the `jeeves` database and pg-boss queues. The scratch server picked up an e2e run's step job and started **real Codex in an e2e temp folder**. I killed that process; it only touched a throwaway folder. Each server's startup recovery also pauses every running run in the database, the other server's included. S11's stub made this harmless; with real agents it isn't. The fix is the separate e2e database (below).

### Deviations and choices the plan left open

- **Retries are separate attempts.** Each agent round is an `attempts` row with its own log, checks, diff, and usage. The executor does one attempt; the service loops. A retry after red checks resumes the Codex session with the check output. After a restart, an agent crash, or a person's Resume without a resumable session, a new session gets the full brief plus the earlier diff.
- **Owned-path violations are reverted by Jeeves** before anything else runs, so out-of-scope edits never reach a commit. The attempt fails with the list and is retried like a red check. Generated-owned files are rejected even inside an element's folder. `pnpm-lock.yaml` is allowed for every task.
- **"No changes" fails the attempt.** A model saying "done" without changing anything isn't evidence.
- **Usage cost is unknown:** Codex reports tokens but no price. `costUsd` exists on the usage type, and the UI shows it when present.
- **Pause still takes effect between tasks**; retries of the current task continue.
- **Codex runs with network on and `approvalPolicy: "never"`,** sandboxed to the project folder for writes. `pnpm install` needs the registry.
- **The coding model setting must be a model the Codex account can use.** S6's default `gpt-5.1-codex` may not be. I used `gpt-6-astra` for the manual run.
- **`pr-per-task` (stretch) is not built.**
- **e2e uses its own database** (`DATABASE_URL=…/jeeves_e2e` in `playwright.config.ts`; the server creates it on start with `ensureDatabase`). AGENTS.md says e2e may run while `pnpm dev` is open. On a shared database each server could run the other's jobs, and with S12 that means real Codex runs on test projects.
- **`runBaseline` gained `unitTests`** and the `unit-tests` step id (`taskCheckSteps`). Generation doesn't use it; the generate service ignores that step id.

### Known issues

- **A killed Jeeves server doesn't kill its Codex process.** The SDK's child isn't tied to the parent, so after a SIGKILL (or Ctrl+C) a running `codex exec` can keep editing the project while the attempt is already marked interrupted. Graceful shutdown doesn't abort running attempts either. A process-group kill on shutdown, and checking for a leftover session before Resume, would fix it.
- **Two Jeeves servers on one database** still cross-run jobs and pause each other's runs on startup. e2e is isolated now, but two dev servers on the same database aren't.
- **Codex reads the whole machine** (see above); only writes are sandboxed.
- **The check log in the feedback is the last 80 lines**, which can miss the first type error in a long output.
- **The attempt log is capped** at 3000 events of 4000 characters. Diffs are capped at 200k characters, and the brief's diff at 30k.
- **Each attempt's checks take about 1 minute** (compose build plus 20 pack checks) on the fixture. There's no incremental mode.
- **Generate is refused only while a run is executing**; regenerating under a `planned` run is still allowed (it gets the S11 warning).
- The `chat.spec.ts` settings test flake from S11 didn't recur in the e2e runs here.

### For S13

- **Real end-to-end setup:** `codex login`, set Settings → Coding to a model the account has, and have an OpenAI key for the chat and planner. The planner's splits matter: with the seed plan, the first service task tends to implement everything.
- **Run output:** results are on `jeeves/run-<id>` in the project folder. The person merges it. `docker compose up` there runs the app.
- **For scripted journeys:** `JEEVES_FAKE_CODING_SCRIPT`, `JEEVES_FAKE_CHECKS`, and `JEEVES_STUB_EXECUTOR` are the switches. `fixtures/coding/README.md` explains the script.
- Consider fixing the orphaned-Codex issue above before long real runs.

---

## S13: End-to-end acceptance and polish (2026-10-29) — PARTIAL: blocked on provider credits

**Status:** the journey ran through chat, canvas edits, Generate (green), and planning on real providers. Orchestration started, then stopped on the first task when Codex ran out of credits. "Implements the notes, and the app runs with all tests green" is **not done yet**. All automated suites pass. The run is waiting for the provider and can be resumed (see "To finish S13").

### Scope change (SRC-17)

At the start the user asked for provider-agnostic model selection, "like Cursor" (SRC-17, in `docs/sources.md`). S13 absorbed the provider picker. Then two blockers came up:

- The OpenAI API key had no credits. The first real chat turn failed with "You have no credits remaining".
- The user has a $20 Claude plan but no Anthropic API key. Anthropic's Agent SDK docs don't allow third-party products to use claude.ai logins, so a Claude adapter is left for after v1 and needs an API key (PLAN §12).

The user chose to run the design chat and planner on Codex (their ChatGPT plan login), so S13 also built a Codex `ModelProvider`. Local models became PLAN §15 **S14**.

### Built

- **Provider catalog** (`packages/providers/src/catalog.ts`): `openai` (model roles), `codex` (model and coding roles), and `local` (listed, `available: false`, pointing at S14).
  - `DEFAULT_ROLE_MODELS`: chat and planner use `openai`/`gpt-5.4-mini`; coding uses `codex` with an empty model, which means Codex's default from `~/.codex/config.toml`.
  - `roleModelProblem` refuses unknown, unavailable, or wrong-kind providers, and an empty model where the provider has no default.
- **Codex as a `ModelProvider`** (`packages/providers/src/codex-model.ts`):
  - Each `respond` is a fresh Codex session: read-only sandbox, an empty scratch folder, network and web search off, `modelReasoningEffort: "medium"`.
  - The whole request goes in one prompt: instructions, each tool's JSON Schema, and the transcript. Images become `local_image` files.
  - Codex answers with `outputSchema` `{message, toolCalls: [{name, arguments: <JSON string>}]}`.
  - The answer maps back to `ModelResponse`, so ChatService and the planner are unchanged.
  - It doesn't stream: the text arrives as one delta. Plain-text answers are tolerated. Errors go through `codexError`, so quota and auth block the provider.
  - The `CodexThreadLike` input type now takes `Input` (text plus images) and `outputSchema`.
- **Settings** (`apps/server/src/settings.ts`, `routes/settings.ts`):
  - The config file has `roles: {designChat|planner|coding: {provider, model}}`.
  - The old `models` map is still read, and it moves into `roles` on the next save.
  - `PUT /settings/roles` replaces `PUT /settings/models`. It returns 422 `INVALID_ROLE_MODEL` with the reason, and saves nothing on a refusal.
  - `GET /settings` lists every provider with `ready`, `status`, and `help`. Codex shows "Logged in" when `$CODEX_HOME/auth.json` exists or `CODEX_API_KEY` is set; Jeeves never reads the credentials.
- **Resolution:**
  - `providerModels(settings, codexPath)` picks OpenAI or Codex per role. Codex is one shared instance, and a logged-out Codex returns an error.
  - `codingAgents` (renamed from `codexAgents`) returns an error for a provider that can't code.
  - `modelLabel(source)` records `codex (default model)` instead of `""` for chat turns and planner runs. Before this, an empty model hid planner usage: the Runs view said "Refined by the planner ()" and "planner not used".
- **Web Settings:**
  - Providers card: a status badge, a description, and setup help for each provider.
  - Models card: for each role, a provider `NativeSelect` and a model `Autocomplete` with suggestions. The local provider shows as disabled "(coming later)", and a provider that isn't ready gets a warning.
- **Polish found on the journey:**
  - **Invisible status badges.** Mantine's light badge with a shade (`teal.9`, used by S12's Runs badges) paints the shade as both background and text. Axe only reports it as "incomplete", so tests passed.
    - The new `shell/StatusBadge.tsx` uses the base color's tint plus a per-color ink of at least 6.5:1 in light mode.
    - Runs and Settings use it.
  - **Rename project** in the project menu (modal; `PATCH /projects/:id` already existed). Before this, every project stayed "Untitled design" and generated into `~/jeeves-projects/untitled-design`.
  - **The task brief no longer tells the agent to run the template test packs.** They live in Jeeves, and the real run showed Codex searching `~/github/jeeves` and writing a script to run them, which spent credits. The agent now runs install, typecheck, and test (and compose if Docker works), and is told not to look for the packs (`AGENT_CHECKS` in `brief.ts`).
  - The chat Send button and the rename button use `cyan.9`, the contrast fix S10 noted.
- **Docs:** PLAN §2 decision row, §12 rewritten (picker table, Codex as model, Claude needs an API key), the S13 note, the new **S14: Local models**, and the decision log. `docs/sources.md` SRC-17 (verbatim). README: a "User guide: from a brief to a running app" section and "Providers and models" (replaces "Design chat and API keys").

### The journey (real providers, 2026-10-29)

Setup: `pnpm dev` (OpenAI key in the environment, but no credits on it); Codex logged in with a ChatGPT plan (default model `gpt-6-astra`, reasoning high for coding). Every UI step was driven by mouse with a Playwright script against the dev server (scratch scripts, not committed). The brief was a "Reading list" app: save URLs with an optional title, list newest first, mark read or unread, delete, an unread count, http(s) validation with a 400, and duplicate URLs return the existing article.

| # | Step | Result |
| --- | --- | --- |
| 0 | Settings: Design chat and Planner → Codex, model empty | Saved; the screenshot showed the badges with **invisible text** → fixed (StatusBadge) |
| 1a | New project, Chat: attach the brief, "Make me a design for the app in the attached brief." on **OpenAI** | **Failed in 3 s**: "You have no credits remaining…". The turn stored the error and the board was untouched (correct handling). Blocker → built Codex as a model provider |
| 1b | The same on **Codex** | **Done in 59 s**, 50,860 in / 1,422 out tokens. `listTemplates`, five `describeTemplate` calls, one `applyOperations` (5 changes), one undo step. Result: `reading-service` (http-service + rest-api-server `/api`), `reading-db` (postgres 17), `reading-web` (web-app + rest-api-client), `uses-database` + `calls`, **0 findings**, with detailed notes on every element and attachment |
| 2 | Canvas: select the web app, Inspector: Title → "My reading list", append an All/Unread/Read filter requirement to the notes | Saved as revision 3, by mouse |
| 3 | Project menu → **Rename project** "Reading list" (added this section), then Generate with the baseline | Default folder `~/jeeves-projects/reading-list`. **Green in 83 s**: generate, install, typecheck, compose-up, test-packs (**20/20**), compose-down |
| 4 | Runs → Plan a run (planner on Codex) | **Planned in 107 s**, 17,692 / 2,575 tokens. 8 tasks: a db "verify" task, API contract and handlers, URL identity/atomic dupes, list consistency, typed client, page and filters, mutations, browser flows. Each has 3–5 acceptance tests and owned paths from the lock. The planner flagged that the chat's notes asked for an `/api` proxy while the web-app template serves same-origin calls at `/_api/reading-service/` |
| 5 | Edit the plan by mouse: remove the db task (the postgres pack already checks isolation, and an agent can't change anything there usefully); edit the two `/api` tasks to use the template prefix; Start | 7 tasks, run 23, branch-per-task, 2 retries |
| 6 | Task 1 (`reading-service.reading-api`) on Codex | After about 5 min: **`waiting_for_provider`**, "Codex: Your workspace is out of credits. Ask your workspace owner to refill in order to continue." The task went back to pending, there was no retry loop, and the partial work (contract, migration, feature, tests) stays uncommitted on `jeeves/run-23-reading-service.reading-api` |

Not reached: tasks 1–7 implemented, Jeeves's checks on real work, the run branch merged, and the app used in the browser.

### Commands and results

`pnpm check` (final):

```text
$ biome check .
Checked 362 files in 113ms. No fixes applied.
$ pnpm -r --no-bail typecheck
(all workspace packages: Done)
$ vitest run
 Test Files  56 passed (56)
      Tests  410 passed (410)
```

`pnpm test:e2e`:

- First full run: 15 passed and 2 failed. Axe flagged teal shade 9 on its tint (4.32:1), on Settings and in the shell test. I fixed it with darker inks.
- Next run of three specs: 6 failed, all at page load ("Drawing tools" toolbar not found) while the real Codex run was loading the machine.
- Full rerun: **17 passed** (25.6 s).

New and changed tests:

- `codex-model.test.ts` (3): the prompt and images, read-only options, `outputSchema`, mapping, scratch cleanup, plain-text fallback, quota errors.
- `settings.test.ts` (5): provider status, roles save and refusals (422 with nothing saved), legacy `models` migration, Codex login detection, role resolution, `modelLabel`.
- `agent.test.ts`: brief check wording.
- e2e:
  - `chat.spec.ts` settings test: provider and model per role, the local option disabled, axe.
  - `generate.spec.ts`: rename project, and the default folder follows the name.

### Deviations

- The provider picker and the Codex model provider were built in S13 (SRC-17), not after v1.
- The web app's `/api` proxy note conflicts with the template's `/_api/<service>/` prefix. The design chat writes notes from template descriptions and doesn't see this. I fixed it in the plan, not the design. Task 7's acceptance tests still mention `/api`, because I only edited descriptions and tasks lock once the run starts.
- During the run I used a non-watch server (`node --import tsx src/main.ts` plus the web `pnpm dev`), so code edits couldn't restart it mid-task (`tsx watch` would pause the run).

### Known issues

- **Both providers are out of credits on this machine:** the OpenAI API (no credits) and Codex ("workspace is out of credits").
- **Run 23 shows planner usage as unknown** and "Refined by the planner ()": it was planned before the `modelLabel` fix. New runs are fine.
- **Codex as a chat model costs a fresh session per tool round** (about 15–25 s each; a design turn took 59 s and about 50k input tokens, mostly Codex's own system prompt plus the catalog). It doesn't stream.
- **Generated compose files publish random host ports** (`127.0.0.1::5173`). The README tells people to use `docker compose port`. Showing the URL in Jeeves would help.
- **Codex still reads outside the project** (S12). The brief fix removes the main reason it did.
- The S12 orphaned-Codex-on-SIGKILL issue is unchanged.

### To finish S13

1. Restore credits for whichever provider will do the coding (Codex workspace credits, or wait for the plan's limit to reset). Optionally add OpenAI API credits for a faster chat and planner.
2. `pnpm dev` → Runs → project "Reading list", run 23 → **Resume**. Task 1 continues from the work already in the folder (a new session briefed with the earlier diff).
3. When the run succeeds:

   ```bash
   cd ~/jeeves-projects/reading-list
   git merge jeeves/run-23
   docker compose up --build --wait
   docker compose port reading-web 5173
   ```

   Then use the app in a browser: save, duplicate, filter, toggle, delete.
4. Append the results under a new handoff entry, "S13 (continued)".

### For S14

- Add the provider in `catalog.ts` (`available: true`) and in `providerModels`/`codingAgents`. Follow the `providerStatus` pattern for a reachability check.
- `codex-model.ts` shows how to wrap an agent-style backend. An OpenAI-compatible Chat Completions adapter should use native tools instead, like `openai.ts`.
- To compare quality, rerun this section's brief, `fixtures/briefs/reading-list.md`. The step 1b output above is the bar for the design chat.


---

## Improvements P1–P2: specification and editor/provider review (2026-10-29)

**Status:** the first two packages are complete as review artifacts. Resource runtime/generator implementation, production editor changes, Runs/usage changes, and qrwty are still pending the architectural review explicitly required by the user's plan. No architectural choice has been inferred from passing prototype tests.

### Built

- `docs/improvements.md`: confirmed service/subtype/component interaction, outer-only connections, a concrete minimal resource schema and qrwty config example, generated SQL/handler/file examples, operation and migration compatibility, REST/Postgres connection definitions, independent verification, extension-derived tasks, Runs modes, usage/evidence ledger, ordered delivery and review checkpoints.
- `docs/editor-provider-review.md`: actual React Flow/Excalidraw interaction comparison, a recommendation to retain React Flow, official-source provider authentication/execution investigation, and a concrete Settings layout. Credentials/configuration, login, available models, inference success, and quota are distinguished. Anthropic subscription login is not offered as a supported third-party integration.
- `docs/examples/qrwty.md`: current scope and proposed service/auth boundaries, plus fixed QR-01–QR-09 acceptance cases. The acceptance must independently decode the downloaded image, follow the actual URL, change destinations with stable identity/image, test owner isolation and request activity, and prove restart persistence. Historical hardware/product background remains below a clear historical heading.
- PLAN/README corrections: S13 is partial, not demonstrated end-to-end application acceptance; qrwty is the proving milestone; local-model S14 is deferred; original section descriptions/decision history remain clearly historical. New work is governed by `docs/improvements.md`.
- Isolated runnable development entry `apps/web/editor-review.html` and `src/editor-review/`: both real engines, generic Service rectangles, inline/inspector subtype selection, compatible internal components, customized-subtype discard confirmation, distinct Postgres shape, native selection/resize/arrows/reconnection. Temporary state only, no project API calls. Open `http://127.0.0.1:4300/editor-review.html` with `pnpm --filter @jeeves/web dev`.
- Exact dev dependency `@excalidraw/excalidraw@0.18.0`; its package supports React 19 and predates the two-week dependency cutoff. Production imports and normal build entry stay unchanged; the normal built bundle contains no Excalidraw/comparison code.
- Two browser tests exercise actual mouse gestures and controls in both engines. Excalidraw test verifies native outer bindings, reconnection, actual outer width after native resize, and an arrow bound to `service-component-0`. That last assertion demonstrates the adapter needed to enforce outer-only endpoints. React Flow test covers inline subtype, compatible components, cancel/confirm, only outer handles, connections, resize, and validated reconnection.

### Commands and evidence

The shell initially did not expose `pnpm`; commands used `PATH=/home/ash/.local/share/pnpm/bin:$PATH` with the repository's pinned pnpm 12.16.1.

- `pnpm check`: Biome checked 366 files with no fixes; all workspace TypeScript checks passed; 56 unit test files / **410 tests passed**. Unit tests use no Docker/network.
- `pnpm test:e2e`: **19 passed (25.4 s)**. Existing 17 scripted-provider journeys plus two real-engine comparison tests. Jeeves's database was running; e2e uses its isolated database/ports per the existing configuration. These results do not establish real-model application quality.
- `pnpm --filter @jeeves/web build`: passed. Existing large-chunk warning; comparison entry excluded from normal output. Inspected the Excalidraw screenshot to confirm actual rendering, then strengthened resize verification to assert the service width rather than any scene change.
- `pnpm lint` and `git diff --check`: passed.
- `pnpm peers check`: reports older React/ReactDOM peer ranges in Excalidraw's transitive Radix packages. The parent Excalidraw dependency declares React 19 support; tested interactions pass. This remains an isolated dev-prototype limitation.
- Early prototype tests exposed locator/click issues with native toolbar radio overlays and shape selection under Excalidraw's style panel. Fixed clicks on actual toolbar labels and verified actual outer geometry; the final full run passed.
- Template/Docker conformance tests were not run: no template/runtime/generator behavior changed. No paid inference, real application build, external repo change, deployment, or benchmark was performed.

### Compatibility and limitations

No design/database migration has been applied. Current product behavior is retained; proposed v2 connection conversion and immutable model migrations are documented for the next implementation. Existing handoff entries are untouched.

The comparison is a spike: no production history, saving, semantic validation bridge, or complete subtype-discard semantics. Excalidraw native geometry permits arbitrary drawing/bindings; React Flow's smooth-step routing does not avoid obstacles. Dense-board routing and a complete engine migration have not been demonstrated. React Flow resize gestures emit browser ResizeObserver notification warnings despite passing measured geometry assertions. Remove the dev spike/dependency after review if it is no longer useful.

Current REST parsing checks JSON body schemas only; QR PNG content and redirect headers require explicit new verification. Existing empty REST smoke checks still silently pass; P4 must change this while distinguishing template conformance from application acceptance. Do not describe this as fixed by the specification.

### Precise next steps

1. Obtain the resource-pattern and editor recommendations review requested in P1/P2: `docs/improvements.md` and `docs/editor-provider-review.md`. Recommendation: retain React Flow and use the small owner-scoped resource pattern.
2. After approval, implement P3 in the existing spec/validated operations, registry, templates, and generator. Keep one source of truth, preserve custom-code ownership, add explicit REST/Postgres definitions, and test legacy migration/regeneration including destructive-change reporting.
3. P4: protect generated/fixed behavior tests from agents, fail uncovered/empty required smoke checks with operation IDs, handle PNG/redirect verification, and seed tasks from extensions instead of rediscovering architecture.
4. P5: implement simplified Runs, persisted continuous/review-after-task modes (continuous default), cumulative implementation usage including all failures/retries/planning, provenance, and human interventions; exclude design chat.
5. Before qrwty implementation, review the proposed one HTTP service + web frontend + Postgres and email/password with opaque server sessions. Login/auth in a sketch is not authorization for separate services. Fix extension request/response contracts and acceptance before model tasks. Run QR-01–QR-09 through Jeeves, then agree one additive feature and demonstrate regeneration/preserved code/cumulative usage. Model comparisons come afterward.


---

## Improvements: approvals and fresh-context handoff (2026-10-29)

The user explicitly **approved all three recommendations** after P1–P2 (SRC-18 in `docs/sources.md`):

1. The owner-scoped structured resource pattern and generated-output approach in `docs/improvements.md`.
2. Retaining React Flow, implementing the service/subtype/component hierarchy and outer-only connections in the production editor.
3. qrwty boundaries of one API service + web frontend + Postgres, with email/password authentication and opaque server-managed sessions.

The earlier P1–P2 handoff's pending-approval statements are historical and now superseded. Current specification/PLAN/README/review/qrwty statuses have been updated. Do not ask the user for these approvals again. Routine implementation choices within the approved architecture can proceed; material departures still warrant review. The additive feature after qrwty acceptance remains undecided.

**Next agent: implement P3** in `docs/improvements.md`, including production editor support for the approved structures. Read AGENTS.md, PLAN §15 workflow, the current improvement specification, editor/provider review, qrwty brief, and the two latest handoff entries. Work in this repository; preserve the existing uncommitted P1–P2 work. The comparison is an isolated dev spike, not production implementation. Keep one validated source of truth, runtime/template separation, generated-file drift checks, and project-owned code preservation. Test resource validation/generation, owner isolation, REST/Postgres wiring, mouse-only editing, legacy conversion, and regeneration/migrations. P4 verification/task derivation, P5 Runs/usage, and the actual qrwty proving build follow P3; do not expand into local models or benchmarks first.

Last implementation validation remains: `pnpm check` passed (410 unit tests / 56 files), `pnpm test:e2e` passed (19 tests), and web production build passed. This follow-up changes documentation only. The pnpm executable is `/home/ash/.local/share/pnpm/bin/pnpm` if absent from PATH. No provider-credit availability was rechecked; old credit failures are historical evidence, not an assertion about current balances. Do not expose secrets while checking setup.

The requested fresh-agent prompt is supplied in the conversation. No implementation has been started after approval, and no git commit was created; all previous changes remain in the working tree.

Documentation-only follow-up validation: `pnpm lint` passed (366 files); `git diff --check` passed. Full tests were not repeated because executable files did not change.


---

## Improvements P3: production editor and deterministic resources (2026-10-29)

**Status:** P3 implemented and verified within the approved architecture. P4 verification/task derivation is next, followed by P5 Runs/usage and the actual qrwty proof. No real-provider coding, qrwty build, QR decoding/acceptance run, local-model work, or benchmark was performed. Existing uncommitted P1–P2 work was preserved; no commit was created. Earlier handoff entries are unchanged.

### Implementation

- **One validated model:** `packages/spec/src/resources.ts` defines strict Zod resource, field, relationship, extension-contract and session-contract schemas, with JSON Schema export. REST server config stores the model in `config.model`; manual JSON forms and chat use the existing revisioned, atomic `updateAttachment` operation. Duplicate names/IDs/operations/routes, reserved fields/routes, unknown relationships, required cycles, internal CRUD and missing acceptance references are rejected. Generation compiles contract validators before writes.
- **Production editor:** generic Service placement, inline/inspector subtype selection, compatible internal components, outer handles only, distinct Postgres shape, native resize/reconnection and capability choices in the inspector. New REST connection inference requires a unique compatible pair. Legacy dependency connections remain readable. Subtype changes list discarded configuration/components/connections and require exact revision-bound confirmation through `changeSubtype`. Cancel preserves the design. Chat's `reviewSubtype` creates a human Confirm/Cancel card; model tools cannot self-approve it. Confirm uses the same operations/history route as manual editing.
- **Semantic/layout compatibility:** new designs use v2. `upgradeDesign` lifts v1 attachment endpoints to their parent elements and preserves attachment IDs as `connection.config.fromCapability/toCapability`, including distinct old component connections. IDs, notes, configs and template refs remain intact. Read conversion does not write a revision. Layout saves leave original stored semantic JSON untouched; the next semantic edit/undo writes v2. API tests check this against the stored revision and undo snapshot.
- **Generated standard behavior:** REST templates emit stable-ID storage/validation descriptors in `src/generated/resources/`, route registration, CRUD/session OpenAPI, generated client types and clients, migrations, and independent HTTP tests under `tests/generated/<service>/`. The versioned runtime supplies the fixed parameterized repositories/handlers. Owner IDs and creation times come from the server; unknown/identity fields are rejected. Read/update use principal predicates, another owner's ID returns 404, relationship ownership is checked in the mutation query, internal resources expose no public CRUD, and keyset lists are owner-filtered and bounded. URL validation accepts absolute credential-free HTTP/HTTPS destinations without fetching them.
- **Selected authentication:** email/password registration/login and opaque random sessions, hashed session tokens in Postgres, expiry, logout invalidation, HttpOnly/SameSite cookies (Secure on HTTPS), origin plus CSRF-token checks for mutations. Account request/response contracts are Zod-derived and appear in the same generated client contract. `PUBLIC_ORIGIN` is deployment configuration, independent of request Host. This is reusable runtime behavior; qrwty's UI/extensions remain unbuilt.
- **REST/Postgres wiring:** outer capabilities resolve through template-kit, without a client importing server-generator internals. Clients consume generated contracts; generation-time and pretypecheck type output now match byte-for-byte. Web calls use the existing same-origin proxy; explicitly public extension paths also receive full-path proxy locations. Postgres supplies one isolated consumer role/database and required secret environment references for resource consumers. The runtime constructs/encodes credentials from separate environment fields. Legacy non-resource consumers retain existing wiring.
- **Safe regeneration:** lock snapshots include models, fingerprints, selected store identity and generated hashes. Resource/field API renames retain stable physical SQL identities. Nullable additions and widening/relaxation emit new numbered SQL; migration files never get rewritten. The resource migration runner verifies file/applied hashes, serializes with a transaction advisory lock, and applies its journal before existing project-owned Drizzle migrations. Drops, narrowing, new required fields, relationship/ownership changes and store moves stop before writes, reporting affected objects. Reviewed SQL can be supplied through `generateProject.reviewedMigrations` only for matching previous/next fingerprints. Removed extension files are reported and retained; removed operation handlers are not registered. Generated drift checks and scaffold-once code ownership remain enforced.

### Verification and evidence

Commands now resolve plain `pnpm`: at the user's request, `~/.bashrc` permanently includes the installation directory, and `~/.local/bin/pnpm`/`pnpx` links make the already-running application's inherited PATH work. Fresh-shell and current-command resolution both reported pnpm **12.16.1**. No credentials were changed.

- **`pnpm check`: passed**, including all workspace type checks and **444 unit tests / 61 files**. Unit tests require no Docker/Postgres/internet; existing local HTTP/process/Git tests required execution outside the restricted sandbox. Biome passes with style warnings (primarily non-null fixture accesses/string style); they are not verification failures.
- **`pnpm test:e2e`: 22 passed (28.6 s)**. Existing 19 journeys remain green; two new production editor tests cover subtype cancel/confirm/undo/reload, outer capabilities, ambiguity, native reconnection and semantic/layout separation. A new scripted-chat test covers human subtype review cancellation/confirmation/undo. Existing axe checks pass. ResizeObserver notifications and the existing React Flow attribution warning still appear during browser tests.
- **Focused resource Docker suite:** `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/resources.conformance.ts`: **5 passed (103.38 s)** on final runtime/contract behavior. It generates and type-checks a real service/frontend/consumer/Postgres project; runs the emitted independent QR and related-memo HTTP tests; checks owner/parent isolation, no internal routes, session login/expiry/logout, bounded pagination, same-origin and public-path forwarding, an actual generated service-client request and unavailable-target error, isolated consumer roles, service/Postgres restart persistence and repeated migration application, then rename/nullable-field regeneration with custom code/data retained. This is template behavior evidence, not QR-01–QR-09 application acceptance.
- **Full template suite during implementation:** 75 passed / 1 failed (8 files, 76 tests). All **72 pre-existing conformance cases passed**. The intermediate resource suite failed its newly added parent-fixture generated test; the subsequent focused suite passes both emitted tests and all five final resource cases. The complete long-running suite was not repeated after the focused fix; there is no claim of a final all-green full-suite invocation.
- **Web production build:** passed (existing large-chunk warning). The isolated editor comparison remains excluded from the normal entry.
- **`git diff --check`: passed**. No dependency additions were needed for P3; the pre-existing Excalidraw spike/dependency and lockfile changes are retained.

Intermediate checks caught and corrected: stale assertions expecting v1/attachment handles, the generated-client type header causing false ownership drift after typecheck, test fixture parent setup, stale published ports after container restarts, a missing JSON body on a generated logout request, resize callback/closing-modal pointer timing, and browser tests observing a streamed reply or an old review card before the saved result. Final counts above are from completed runs, not inferred from those failures.

### Compatibility implications and limits

- Resource SQL lives at `services/<owner>/resource-migrations/`, rather than the illustrative database directory: it follows the existing consumer-owned migration lifecycle and isolated database/role. Stable-ID hashed physical table/column names make API renames storage-preserving. The existing template/runtime versions remain pinned; additions preserve old generated behavior, demonstrated by legacy golden/unit and conformance coverage.
- Old designs do not acquire resource models from their notes. Opting an existing custom contract into generated resource ownership stops on the unmanaged contract until the project is explicitly migrated; custom contracts are never overwritten silently. Store transfers and removal of an entire emitted model remain manual migration work. Reviewed SQL is a generator-library API, not a new browser SQL approval workflow.
- Nested resource authoring currently uses the existing validated JSON form and chat. A separate field-by-field resource designer was not added. Required wiring/configuration remains visible through findings. New generation supports one explicitly selected Postgres store per HTTP service.
- Extension skeletons deliberately register no handler and report 501 until implemented. Retained removed-extension operation handlers are inactive; unrelated project-owned feature hooks remain custom code. Generated tests are hashed and outside agent-owned paths, but **P4 still must execute/enforce these tests in run verification**. Internal/read-only relationship fixtures and resources without create require explicit isolated fixture IDs; missing fixture configuration fails the generated tests.
- P4's required nonempty smoke coverage, binary/image and redirect-header evidence, fixed project acceptance harness and extension-derived task seeding are still outstanding. P5's simplified Runs/review modes/usage ledger are unchanged. Provider/Settings simplification from the review is also outstanding. Passing template tests is not evidence of a finished qrwty application.

### Precise next steps / fresh-chat boundary

1. Start a fresh chat for **P4 only**. Read AGENTS.md, PLAN §15, `docs/improvements.md` (including P3 notes), and the latest two handoffs. Preserve this uncommitted work. Use `fixtures/designs/resources.json`, the resource conformance test, `lock.resourceModels/resourceFingerprints/resourceStores`, generated contracts, and `tests/generated/` as concrete inputs.
2. Integrate independent generated/fixed tests into verification using disposable fixtures; fail required empty/uncovered smoke checks with operation IDs; explicitly handle PNG and redirect headers. Preserve generated-file and fixed acceptance ownership. Derive tasks from extension IDs, operation IDs and acceptance references instead of planning standard CRUD or new service boundaries.
3. After P4, use another fresh chat for P5 Runs/usage. Then build qrwty through Jeeves with the already approved one API + web + Postgres and session authentication. Complete its three fixed extension contracts and QR-01–QR-09 harness before model implementation. No architecture reapproval is needed. The later additive feature remains undecided; local models and benchmarks stay deferred.


---

## Improvements: local commit policy and P1–P3 checkpoint (2026-10-29)

The user requested a local commit for each completed improvement package, following the S-history convention, and explicitly gave standing authorization: **do not ask permission for local commits**. AGENTS.md, PLAN §15's completion workflow, and `docs/improvements.md` now require the package/section commit after checks and handoff, with its ID in the title and unrelated working-tree changes preserved.

P1/P2 were already combined with P3 in the uncommitted working tree. This checkpoint therefore commits the completed P1–P3 work together under `P3: Deterministic resources and production editor (includes P1-P2)`, without fabricating separate historical package commits. Earlier statements that no commit existed describe their original handoff time and are superseded by this checkpoint. Subsequent packages, starting with P4, must have separate completion commits.

Validation of the implementation remains the completed P3 evidence above: `pnpm check` passed (444 unit tests), 22 browser tests passed, five focused resource Docker checks passed, and the web production build passed. This follow-up changes instructions/documentation only; `pnpm lint` and `git diff --check` are the relevant follow-up checks. P4 remains the next implementation package, in a fresh chat.


---

## Improvements P4: independent verification and extension-derived tasks (2026-10-29)

**Status:** P4 implemented. P5 Runs/usage is next; qrwty and QR-01–QR-09 remain unbuilt. No real-provider/model calls, paid inference, deployment, benchmark, or P5 implementation was performed. The working tree was clean on entry, so there was no pre-existing uncommitted work to move or stage. Earlier handoffs are unchanged. This package receives its own local P4 commit under the standing commit authorization.

### Implementation

- **Independent expectations:** `generateProject`/`planProject` accept reviewed `fixedAcceptance` registrations (`id`, `service`, `operationIds`, `acceptanceIds`, Node `node:test` source). Zod validates registrations against the resource model. Suites are emitted under `tests/acceptance/<service>/`, hashed in `lock.files`, and registered in `lock.fixedAcceptance`. Omitted registrations are retained on regeneration. Changed/missing expectations block regeneration. Generated session/CRUD and fixed acceptance tests are outside agent-owned paths; executor checks reject those namespaces, including additions or replacement of the directories themselves, even under broad task-owned paths. Missing/modified/symlinked generated artifacts fail verification.
- **Disposable behavior verification:** the baseline and task checks execute independent Node suites directly, outside project-owned package test scripts. Node must report actual tests with no skipped/todo cases. A new fixture Compose project uses fresh volumes, ephemeral loopback ports, fixture database credentials/public origin, and a minimal test-process environment that does not inherit ambient credentials or database settings. Unsafe writable mounts/external database wiring are rejected. Fixture containers, volumes and local images are removed on the cleanup path, including failure/cancellation. Generated tests now include independent session registration/login/identity/CSRF/logout checks and stronger CRUD value, persistence, identity, length/required-field and owner-isolation assertions.
- **Truthful layers and coverage:** infrastructure startup, template conformance and application acceptance are distinct. Required stateless smoke checks fail on zero requests, missing eligible examples (with operation IDs), and documented error responses used as successful examples. Inapplicable checks carry explicit skip reasons. Stateful operations use the isolated suites instead of unsafe stateless examples. Generate/attempt details show skipped reasons and exclude skipped checks from pass counts. Baseline generation defers unfinished extensions visibly while still testing standard behavior. Task verification requires the current and previously completed extensions in that run; frontend/other work requires all extensions. Missing independently runnable fixed acceptance mappings fail before a coding-agent call. Removing a required extension task cannot silently produce a successful finished run: the terminal guard lists its unverified operation ID.
- **Binary and redirect evidence:** OpenAPI parsing retains response media and headers. Response validation checks documented headers and PNG signature/chunk CRCs, decompression, dimensions and scanline framing (bounded to 32 MiB); unsupported non-JSON media fails explicitly. Smoke fetches use manual redirect handling, so Location/cache-header checks inspect the actual redirect. Fixed technical conformance fixtures independently assert PNG bytes and redirect status/headers. These do not encode or decode QR codes and are not qrwty acceptance.
- **Deterministic remaining tasks:** structured services seed stable element/attachment/extension keys, operation IDs, fixed contracts and acceptance references. Their stale service/component prose does not seed standard CRUD or new architecture. Paths allow the extension feature directory, supplemental service tests, the service package manifest for dependencies, and the existing shared lockfile allowance. Structured plans bypass inference; legacy notes-based plans keep the existing planner. Briefs include the owning generated contract and protected-test rules. Completed-task keys use existing persisted task records; no database migration was needed for the optional JSON verification fields/statuses.
- **Baseline integration fixes exposed by P4:** template checks now read resolved Compose configuration without logging secrets. The Postgres pack supports separate consumer credential fields as well as legacy DATABASE_URL. The REST pack expects the root server URL for resource contracts containing full paths. Legacy golden/unit/conformance behavior is retained.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **387 files**, all workspace type checks passed, **461 unit tests / 63 files passed (23.02 s)**. The existing warning/info style diagnostics remain (108 warnings / 55 infos); there are no lint errors. New unit tests use local files/child Node processes, not Docker, Postgres or internet access.
- **Browser:** initial `pnpm test:e2e` passed **23 tests (29.2 s)**. A later concurrent run with the long Docker suite plus unit checks had 10 failures / 13 passes, largely blank-page startup timeouts in the shared helper and a generation timeout. No unrelated UI changes were made for that run. The final `pnpm exec playwright test --workers=2` passed **all 23 (44.9 s)**, including mouse-only verification-layer display, skip reasons and axe. Existing ResizeObserver/React Flow attribution warnings remain.
- **Final focused Docker:** `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/verification.conformance.ts`: **4 passed (107.32 s)**. It checks generated session/CRUD plus fixed authenticated/PNG/redirect acceptance, a green normal baseline with unfinished extensions visibly deferred, deliberately incorrect application output failing fixed acceptance while standard behavior passes, protected-test drift stopping before install/Docker, and fixture cleanup.
- **Earlier full Docker invocation:** `pnpm test:templates`: **79 passed / 2 failed, 81 tests / 9 files (684.07 s)**. All other eight files passed. Both failures and its teardown error were in the new verification suite: an old loaded session-test name versus an assertion changed while the suite was running, the resource root URL/separate-credentials integration gaps, and teardown needing its fixture environment restored. The final focused four-case run above passes all corrected cases. The full suite was not repeated after those fixes; do not claim a final all-green full-suite invocation. Avoid changing imported code while a long suite is still running. The two earlier fixture volumes/images left by the failing teardown were explicitly cleaned; final Docker inspection showed only Jeeves's pre-existing Postgres container and no P4 fixture volumes.
- **`pnpm --filter @jeeves/web build`: passed** (existing large-chunk warning). **`git diff --check`: passed.** No dependencies or lockfile versions changed. Documentation follow-up is checked with `pnpm lint` before the package commit.

### Compatibility, limits and next steps

The fixed-suite registration API is currently a generator-library interface, not a new browser authoring flow. Suites must be supplied/reviewed before coding. A suite declaring several operations waits until all are required; provide an independently runnable suite for each task. Declared mappings and successful execution do not replace human review of the fixed assertions.

Automatic standard fixtures currently support creatable owner resources and creatable owner parents. Resources without create or with internal/read-only parents still fail with explicit fixture requirements; the runner never borrows application data or ambient fixture IDs. PNG structural verification does not establish QR payload correctness. Full QR decoding, stable public URL identity, owner behavior of the custom extensions, redirect transactions/request counts and QR-01–QR-09 must be fixed/tested in the qrwty proving milestone.

Replanning currently seeds the declared extensions again; cross-run reuse/change detection is still needed with the following Runs/evidence and additive-feature workflow. P5's usage ledger, initial/feature-run provenance, review-after-task mode and simplified Runs presentation are untouched. Legacy designs retain planner compatibility; no old prose is turned into resources.

**Next: P5 only**, in a fresh context. Read AGENTS.md, PLAN §15, the improvement specification and the latest two handoffs. Keep P4 verification layers, operation/reference coverage, protected tests and disposable fixtures intact while adding the Runs presentation, persisted continuous/review modes and cumulative implementation usage/evidence. After P5, complete qrwty's three fixed contracts and QR-01–QR-09 acceptance source before any model implementation, then run the approved one API + web + Postgres/session architecture through Jeeves. No architecture reapproval is needed. The later additive feature remains undecided.


---

## Improvements P5: Runs, execution review and implementation evidence (2026-10-29)

**Status:** P5 implemented. The next milestone is the qrwty proving application under its approved boundaries and fixed QR-01–QR-09 acceptance. No real-provider calls, paid inference, qrwty implementation, QR decoding/application acceptance, deployment, local-model work or benchmark was performed. The working tree was clean on entry. Earlier handoffs are unchanged; this package receives its own local P5 commit under the standing authorization.

### Implementation

- **Runs presentation:** progress, current activity, blockers, elapsed wall time and implementation usage lead the selected run. Before Start, the view shows generated capabilities, remaining tasks, the current coding selection, verification layers and execution mode. Capabilities/verification collapse after starting; task prose/paths, planning/Git details, logs, diffs, detailed checks and evidence use mouse-operable disclosures. Design and coding selection remain separate. The sidebar shows the cumulative project total and initial-build/feature/legacy run labels; new-run Git/retry controls are disclosed.
- **Persisted execution modes:** continuous remains the default. Review-after-task pauses after a successful task's independent checks and commit when another pending task remains. Resume continues the next pending task; the final successful task completes the run. Failure retries/provider stops retain their existing behavior. Mode changes are permitted before Start or while stopped between tasks, recorded as interventions, and survive reload/restart. The new create API optionally accepts execution mode and initial-build/feature kind. Later runs default to feature after a successful run and retain their predecessor ID.
- **Leaf usage ledger:** the new `implementation_usage` table retains every planner round and coding attempt, including invalid-plan corrections, failures, retries, interrupted calls, cancellation and planning again. Project/run/task totals sum these records once, without adding already aggregated summaries. Tokens and costs have separate reporting coverage; unknown values preserve known subtotals and never become a reported zero cost. Design-chat tables are excluded. A coding invocation's reported usage is saved before checks/commit, and Codex emits completed-turn usage before returning. Restart recovery marks unfinished ledger records interrupted while retaining reported usage.
- **Provenance and help:** each new run stores the generated design revision/hash, template versions, initial Git revision and planned coding selection. Each actual invocation retains its provider/model and prompt/request; coding records also store their starting Git revision and the run's Git/retry/mode settings. Existing attempt checks, diffs, commits, events and timestamps remain the verification evidence. Actions, mode changes and task edits/removals/reorders receive timestamped notes; an explicit Record note form captures human help/review. Provider credential/configuration objects and environment variables are not copied into the ledger. Generated-design changes refuse Start/Resume and stop between tasks until a new run captures the baseline.
- **Compatibility:** migration `0005_runs_evidence` adds the ledger/mode/provenance fields and imports surviving historical attempt/planner usage. It preserves existing runs/tasks/attempts and defaults their execution to continuous. Historical run kind/provenance remains unknown. Ledger task/attempt references use `SET NULL`, so deleting/replanning tasks does not discard their usage. Existing usage response fields remain available alongside the new coverage summaries. No dependency or lockfile changes.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **390 files** (108 existing warning-level / 55 info diagnostics, no errors), all workspace TypeScript checks passed, **469 unit tests / 64 files passed (22.94 s)**. New checks cover historical migration, separate cost/token coverage, planner failure after earlier reported usage, repeated planning, cumulative feature usage, actual prompts/models, usage saved before later provider/check failure, committed review pauses, reload/resume, interventions and changed-baseline rejection. The persisted server-restart test now checks interrupted partial usage and provenance. Unit tests use no Docker, Postgres service or external network.
- **Final browser:** `pnpm exec playwright test --workers=2`: **24 passed (58.0 s)**, including the new mouse-only review mode/reload/next-task/mode-switch/human-note/cumulative-usage journey and existing failed-attempt evidence paths. Axe checks pass. Inspected `/tmp/jeeves-p5-runs.png` after the final journey. Existing React Flow attribution/ResizeObserver and NO_COLOR warnings remain.
- **Earlier browser invocation:** `pnpm test:e2e -- --workers=2` actually forwarded an extra `--`, so Playwright used its default six workers. It produced **23 passes / 1 failure (33.0 s)**; the failure timed out clicking Save models in the existing Settings journey. All Runs tests passed. The correct final two-worker invocation passed all 24, including Settings. No Settings implementation was changed.
- **Final web production build:** `pnpm --filter @jeeves/web build`: passed (468 ms, existing large-chunk warning). The editor comparison remains excluded from the normal bundle.
- **Intermediate checks:** the first optional-body route schema rejected empty POST bodies; fixed with nullish validation and existing API coverage. Initial checks also caught new migration JSON formatting, the expected new Codex usage event, and a restart-test subtotal assertion that omitted the first task's retained partial usage; corrected before the final full check. No failing result is counted as a pass.
- **`git diff --check`: passed.** Final handoff/documentation follow-up uses `pnpm lint` before commit. Template Docker conformance was not repeated: no generated template/runtime/check behavior changed; the full unit suite retains P4 ownership/coverage checks, and the real executor paths are exercised with scripted agents. Browser tests use Jeeves's existing Postgres and scripted providers/marker checks, not real-model application acceptance.

### Limits and precise next steps

Historical overwritten planner calls, deleted attempts, prompts and provider provenance cannot be reconstructed. Imported known usage is a surviving subtotal, not a claim of complete historical expenditure. Codex reports tokens but no dollar cost. A coding attempt blocked before invocation remains an explicit attempt record with unknown usage; it is not evidence of paid inference. Elapsed time is wall time from persisted timestamps, including waiting/review, rather than a provider billable-duration estimate. Raw per-run requests currently travel with run detail; large-history pagination is not implemented.

New runs conservatively seed declared extensions again. Automatic cross-run reuse/change detection is not part of this package: stable task keys alone never imply acceptance. Address that explicitly during the later additive-feature proof if reusing completed work, and re-run independent acceptance against preserved code. Production Settings simplification remains outside this package. The fixed-suite registration interface remains the generator-library API from P4; protected tests, coverage checks and disposable verification fixtures are unchanged.

**Next: qrwty proving milestone**, in fresh context. Read AGENTS.md, PLAN §15, the current improvement specification, qrwty brief and latest handoffs. Complete qrwty's three extension contracts and reviewed independently runnable QR-01–QR-09 suites before any coding-model implementation. Generate and run it through Jeeves with the approved one API + web + Postgres and email/password/server sessions. Record actual provider failures, usage and human help through the new evidence flow. Demonstrate downloaded-image QR decoding, real redirects, owner isolation, request counts and restart persistence. Only after initial acceptance, agree the additive feature and demonstrate regeneration, preserved code and cumulative feature usage. No architecture reapproval is needed; local models and comparisons remain deferred.


---

## Improvements P6: qrwty acceptance enablement (2026-10-29)

**Status:** P6 implemented. qrwty QR-01–QR-09 remain unrun; the application, its UI, and its coding tasks were not built. No real model/provider call, paid inference, deployment or benchmark was performed. The working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched and is not part of this package. Earlier handoff entries are unchanged. This package receives its own local P6 commit under the standing authorization.

### Implementation

- **Reviewed qrwty fixture:** `fixtures/designs/qrwty.json` is a schema-v2 design with the approved one API + web + Postgres shape, two resources (`qr`, internal `scan`), nine acceptance cases, three fixed extension contracts, empty element/attachment notes, complete extension notes, complete web notes plus fixed browser test hooks, `qrcode@1.5.4` on the image extension, and `hostPort: 5173`. `fixtures/designs/qrwty.layout.json` fixes the board. `designSchema` and `validateDesign` report zero findings.
- **Fixed acceptance assets:** `fixtures/acceptance/qrwty/` contains `core`, `qr-image`, `redirect`, `activity`, `restart`, and `browser` suites and shared `_support/` clients, QR decoder, local destination servers, DB/Compose fixture access, and restart helper. QR image checks use `jsqr@1.4.0` + `pngjs@7.0.0`; browser checks use `@playwright/test@1.63.0`. The app's encoder is never the verifier. Activity rows are inserted through `psql` in the disposable fixture at fixed UTC times; restart uses the same named volumes; browser checks run against `JEEVES_TEST_WEB_URL`.
- **Bootstrap:** `pnpm qrwty:bootstrap` uses the server's existing `tsx`. It creates/reuses a `qrwty` project through the API, applies the fixture through `POST /projects/:id/operations`, reads the design, validates it, generates into the UI's default output folder with the six suites, writes `DB_QRWTY_PASSWORD` and `QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173` to `.env`, and regenerates without `fixedAcceptance` to prove the lock retains every suite. It refuses to overwrite a different existing design.
- **Harness:** fixed suites now carry `requires` (`extensions`/`frontend`), `runner` (`node`/`playwright`), generated-owned support files, and exact test dependencies. The disposable fixture reserves a free web port, publishes it, makes it every resource service's `PUBLIC_ORIGIN`, and exposes compose project/file, project dir, service/web URLs, DB element, and the current service port. A frontend suite is skipped with a visible "waiting for the frontend" reason and its acceptance IDs until the frontend task. A restart may republish the service's ephemeral host port, so the restart helper rediscovers it from Compose. On failure the harness logs each fixture container's last lines.
- **Traceability and gate:** `CheckOutcome`, `CheckRecord`, Generate, Runs capabilities, and attempt details carry acceptance IDs. Planning rejects a lock whose declared acceptance cases have no suite. The terminal gate requires a passing fixed-suite record for every `model.acceptanceCases` entry; skipped suites are listed but never count as passes.
- **Origin and environment:** `web-app` gained optional `hostPort`; qrwty publishes `127.0.0.1:5173:5173`. The service's validated `PUBLIC_ORIGIN` is the web origin, so CSRF/cookies and decoded QR URLs agree. The bootstrap creates `.env` before the UI baseline; Compose still fails clearly when a required template variable is absent.
- **Generated ownership and guides:** `AGENTS.md` lists this project's actual generated-owned paths and no longer calls structured contracts project-owned. Element notes put implementation notes and agent guides before the large model JSON, and structured services state "Generated standard behavior (do not reimplement)". The http-service/rest-api-server/rest-api-client guides document `database.pool`, resource descriptors, `withTransaction`, `sessionPrincipal`, `publicOrigin()`, binary blob downloads, and extension-only work. Service tests consistently use `tests/`.
- **Error and update semantics:** extension contracts inject JSON error bodies for standard 400/401/403/404/409/422/500 responses when only a description is supplied. PATCH is a true partial update, so an omitted optional title is preserved. A newly added generated timestamp is additive in the migration planner. Tests cover all three.
- **Stale text:** design-chat instructions and `PORT_INCOMPATIBLE` now describe outer-element endpoints and capability selection; template docs and the qrwty example link the committed fixture.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **407 files** (131 existing warning-level / 57 info diagnostics, no errors), every workspace type check passed, **481 unit tests / 65 files passed (25.99 s)**. Unit tests use no Docker, Postgres service or external network.
- **`pnpm --filter @jeeves/web build`: passed** (7324 modules; existing large-chunk warning). **`git diff --check`: passed.**
- **Focused harness conformance:** `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/harness.conformance.ts`: **2 passed (67.87 s)**. It proves a fixed Node suite can query the disposable DB, insert a scan row, restart Postgres and the service with the same volume, rediscover the republished service port, and that a Playwright suite runs against the fixture web URL. It also proves the frontend-phase skip reason/acceptance ID before the frontend phase.
- **Existing verification conformance:** the same config against `packages/generator/conformance/verification.conformance.ts`: **4 passed (91.64 s)**, including protected-test drift, standard behavior and fixed PNG/redirect/authenticated acceptance in a disposable fixture.
- **qrwty bootstrap:** `pnpm qrwty:bootstrap` printed:
  `Design revision 1; 0 finding(s), no errors.`
  `Lock has 6 fixed suites (activity, browser, core, qr-image, redirect, restart) covering 9 acceptance cases.`
  The second generation (no `fixedAcceptance`) printed the same six-suite/case line. The generated project at `/home/ash/jeeves-projects/qrwty` has `.env` with `DB_QRWTY_PASSWORD` and `QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173`, `qrcode@1.5.4` in `services/qrwty/package.json`, the three test dependencies in the root manifest, and `127.0.0.1:5173:5173` in Compose.
- **Earlier failed harness runs:** the first attempt timed out waiting for `/ready` after restart because restarting Postgres and the service together left the suite holding the old ephemeral host port; a second attempt restarted the database first but still used the old URL. Both failures were fixed by sequential restart plus Compose port rediscovery. These attempts are recorded as failures, not as passes.

### Deviations, limits and next steps

- Added an optional `dependencies` list to extension config so `qrcode@1.5.4` is generated into the owning service package reviewably. This is a small extension of the approved resource config, not a new field type or workflow. No generated data-access facade was added; the supported path is `database.pool`, descriptors, `withTransaction`, `sessionPrincipal`, and `publicOrigin()` as documented.
- Playwright suites use `.test.ts` and run with `pnpm exec playwright test`; the generated project root receives the exact test dependencies. Browser test hooks were added to the qrwty web notes so QR-09 selectors are fixed.
- QR-01–QR-09 have not been executed and no run was started. The generated qrwty project exists outside the repository from the bootstrap proof; it is not committed. The service baseline, browser journey and extension checks still need to be run in the next milestone.
- The terminal gate requires a passing suite record; a suite that is skipped with a reason is shown in the failure message but does not satisfy the case. This is deliberate to prevent false green runs.
- A fixed-suite authoring UI/server route was not added; bootstrap remains the reviewed path.
- **Next:** start the qrwty proving run in a fresh context: verify port 5173 is free, run `pnpm dev`, open exactly `http://127.0.0.1:5173`, Generate with the baseline, plan the four tasks, and run in Review-after-task mode. Do not claim QR-01–QR-09 until the fixed suites and browser journey actually pass.

---

## Improvements P7: qrwty harness correctness (2026-10-30)

**Status:** P7 implemented. No real model/provider call, paid inference, qrwty implementation, QR-01–QR-09 execution or deployment was performed. The working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched and is not part of this package. Earlier handoff entries are unchanged. This package receives its own local P7 commit under the standing authorization.

### Implementation

- **Multi-operation suites wait instead of failing:** `fixedSuiteGate` in `packages/generator/src/baseline/behavior.ts` now reports a visible `skipped` check with the suite's acceptance IDs and `Waiting for operations <missing> before running this suite.` when only some of its operations are required. A suite with none of its operations due still waits quietly, and a suite with all operations required runs. The terminal gate in `apps/server/src/runs/service.ts` is unchanged: skipped records never count as passes, so QR-01/QR-08 remain required by the end of the run. The previous `requires future operations` failure is gone.
- **Browser suite matches the notes (QR-09):** the suite selects a row through a new `data-testid="qr-select"` button, looks up `qr-image-download` and `qr-activity` inside the selected row, and ignores Chromium's `Failed to load resource` console lines caused by expected 401 responses while still rejecting every other console error line. The qrwty web notes now require the select control, say the edit/download/activity actions are shown only for the selected row, require the selection to survive a successful save, and document the new hook. The three `today` helpers carry a comment that a run crossing 00:00 UTC can flake.
- **QR image expectations:** `qr-image.test.ts` asserts a 512x512 PNG via a new `pngSize` helper (pngjs) and requires `content-disposition` to start with `attachment`. It still decodes the URL and checks byte stability; it does not assert error-correction level or margin.
- **Activity boundary pinned:** the `activity` extension notes now define a valid range as `to >= from` and `(to - from)` at most 365 days (at most 366 dates inclusive). `activity.test.ts` asserts 2025-01-01 to 2026-01-01 is 200 and 2025-01-01 to 2026-01-02 is 400.
- **Agent-guide hints:** both service guides now document `sessionPrincipal(...).id` as the owner id compared with `owner_id`, Postgres `Date` values versus `format: "date"` with UTC `to_char`/`date_trunc` examples, binary `Buffer` responses with explicit `content-type` (plus the Fastify reply form), and Fastify's implicit HEAD route. The rest-api-server structured example now imports `defineFeature` from the real scaffold package `@jeeves/service-runtime`. The `redirect` extension notes say HEAD must not insert a scan.
- **Harness coverage:** `harness.conformance.ts` registers a second extension and a two-operation `pair` suite; the existing Docker run now proves a partially required suite yields one skipped check carrying `HARNESS-03` instead of failing, and that the skip is visible before the frontend task.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **408 files** (134 warning-level / 57 info diagnostics, no errors; 131 warnings were already present on HEAD and 3 are in the new test/conformance code), all workspace type checks passed, **485 unit tests / 66 files passed (26.16 s)**. New unit coverage is `packages/generator/src/behavior.test.ts` (partial-required skip carrying QR-01, all-operations-required run, quiet wait, frontend skip). Unit tests need no Docker, Postgres service or network.
- **Focused qrwty fixture:** `pnpm vitest run packages/generator/src/qrwty.test.ts packages/generator/src/behavior.test.ts`: **7 passed / 2 files (751 ms)**; `designSchema`/`validateDesign` still report zero findings for the edited fixture.
- **Harness conformance:** `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/harness.conformance.ts`: **2 passed (71.73 s)**. It proves the disposable fixture DB/restart and browser runner still work and that the partially required `pair` suite is skipped with its acceptance ID.
- **`git diff --check`: passed.** The golden `jeeves/elements/links.md` and `jeeves/lock.json` were updated for the changed guide text and hash.

### Limits and next steps

QR-01–QR-09 are still unbuilt and unrun; these changes make the reviewed checks correct, not passing. The HEAD warning is guidance for the redirect handler, not an application fix. The 512x512/margin/EC expectations are only enforced through the PNG dimensions and decode; margin and EC level are not asserted. The browser suite still depends on the agent building the exact documented hooks and keeping the selected row's actions visible after a save.

**Next: P8 only**, in a fresh context. Read AGENTS.md, PLAN §15, the latest two handoffs and only the P8 section of `docs/build-plan.md`. Do not start P9.

---

## Improvements P8: run robustness (2026-10-30)

**Status:** P8 implemented. No real coding-model/provider call, paid inference, qrwty implementation, QR-01–QR-09 execution or deployment was performed. The manual interruption used the scripted fake coding agent with Jeeves's real checks; it is not model evidence. The working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched and is not part of this package. Earlier handoff entries are unchanged. This package receives its own local P8 commit under the standing authorization.

### Implementation

- **Process-group limits:** `runCommand` spawns detached and, on timeout or abort, sends SIGTERM to the whole process group, then SIGKILL after 5 s. The SIGKILL backstop survives the direct child closing, so a grandchild that ignores SIGTERM still loses the group. `RunResult.timedOut` distinguishes a Jeeves timeout from an ordinary exit. Unit tests prove a `sleep 60` grandchild is gone after a timeout and after an abort, and that a group ignoring SIGTERM is SIGKILLed.
- **Check-step limits:** install 15 min, typecheck 10 min, unit tests 20 min and each template test pack 20 min, scaled by `JEEVES_CHECK_TIMEOUT_MIN`. A timeout is a failed step whose message is `<step> exceeded <n> min`. Failed steps now keep their own last 120 output lines in the step message, so a retry shows the assertion instead of later compose-down noise; the agent's check feedback keeps 200 log lines, and the behavior step keeps its 4,000-character failure excerpt.
- **Coding-session limit:** one agent session is aborted after 45 min (`JEEVES_AGENT_TIMEOUT_MIN` overrides). The attempt fails with `The coding session exceeded <n> minutes and was stopped.`, is not retried as a provider error, and the next attempt starts a new session with the earlier diff. The timeout outcome clears the persisted attempt `sessionId` (a provider session ID is still saved while the session runs), so the service cannot resume the killed session. Auth/quota still block; other agent failures still retry as before.
- **Shutdown and resume:** `RunService.stopAll()` aborts every live planning/step controller and waits up to 10 s. `main.ts` calls it before `app.close()`. During shutdown a stopped attempt is recorded `interrupted` and its task returns to `pending` immediately (the same end state `recoverRuns` would produce on the next start), its usage row is also `interrupted`, and no further step job is queued. Before an interrupted resume's integrity check, only the changed generated-owned tracked files are restored from HEAD (`git restore --source=HEAD`), staged additions under `tests/generated`/`tests/acceptance` are unstaged, and untracked files there are removed. The affected paths are emitted and saved as a `restore-generated` intervention; unchanged lock paths are not listed.
- **Compose hygiene and env preflight:** before `up`, a non-empty `docker compose ps -q` triggers `docker compose down --remove-orphans` (no volumes). The new shared `assertComposeEnvironment` parses `${VAR:?...}` from `docker-compose.yml`, reads `.env` (quotes, `export`, trailing comments), lets the process environment override it, and fails the compose-up step before Docker with `Missing required environment: <names>. Add them to <dir>/.env.` P10 will reuse this helper.
- **Codex errors:** `\b5\d\d\b` now only means unavailable in an HTTP context (`status 5xx`/`HTTP 5xx`). Rate-limit and unavailable turns get one 60 s backoff and one retry inside the same attempt; the retry emits a warning. Two consecutive failures still propagate, so a retry attempts the task only once more.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **411 files** (137 warning-level / 57 info diagnostics, no errors), every workspace type check passed, **503 unit tests / 70 files passed (23.94 s)**. New tests cover group kill/signal/SIGKILL, step-limit scaling and timeout messages, failing-test output in the step message, `.env` preflight, Codex classification/backoff, agent timeout with a new session, interrupted generated-file and staged-orphan restore (including untracked lock paths), and `stopAll`. Unit tests need no Docker, Postgres service or network.
- **Final browser:** `pnpm test:e2e --workers=2`: **24 passed (58.1 s)**, unchanged journeys. Existing React Flow attribution/ResizeObserver warnings remain.
- **`git diff --check`: passed.** No dependency or lockfile changes.
- **Manual Ctrl+C during a fake-agent run:** started the dev server with `JEEVES_FAKE_CODING_SCRIPT` and real checks, bootstrapped/generated qrwty in `/home/ash/jeeves-projects/qrwty`, changed the generated service's `test` script to `sleep 60` (outside the repository), created run **25** (four tasks) and started it. Once the unit-test step had spawned `sleep 60` (PID 94222), sent SIGINT to the server process (PID 92323). The before listing was:
  `94169 pnpm -r --no-bail test` (the process-group leader) → `94215 sh -c ... sleep 60` → `94222 sleep 60`.
  The server exited cleanly. Afterwards `pgrep -af "sleep 60|docker compose|vitest|pnpm"` returned nothing and `docker ps` showed only Jeeves's own Postgres. The database after the stop showed attempt 1 `interrupted`, its task `pending`, and the other three `pending`; the run stays `running` for `recoverRuns` to pause on the next start. The manual project was then deleted from the dev database so it cannot block a later run; the disposable output folder remains outside the repository.

### Deviations, limits and next steps

- The shutdown path records `interrupted`/`pending` immediately rather than waiting for the next `recoverRuns`; this preserves the plan's intended resume state while avoiding a cancelled task being silently skipped. `stopAll` leaves the run's `running` status for the next start to pause.
- A template test pack that hangs is raced against its 20 min limit; the failing step returns, but the underlying check may keep running in memory until its own timeout. This is a last-resort guard, not cancellation inside every pack.
- The manual interruption used a scripted agent and a deliberately sleeping generated test, not a real Codex/OpenCode coding session. It proves the server abort reaches the `pnpm`/`sleep` process group and leaves no survivor; Codex child cleanup itself relies on the SDK's abort path (and the 8.1 agent timeout for a hung session). The pre-existing user Codex daemons on this machine were not touched.
- The Codex backoff is a fixed 60 s (tests inject a shorter delay); there is no per-step environment override beyond the single check multiplier. Docker template conformance was not rerun: no template or generated-project code changed, and the manual run exercised real install/typecheck/test/compose steps.

**Next: P9 only**, in a fresh context. Read AGENTS.md, PLAN §15, the latest two handoffs and only the P9 section of `docs/build-plan.md`. Do not start P10.

---

## Improvements P9: coding providers, effort and Settings (2026-10-30)

**Status:** P9 implemented. No paid Jeeves coding run, qrwty implementation, QR-01–QR-09 execution or deployment was performed. OpenCode CLI smoke calls were made against the user's DeepSeek login (about 0.001 USD total); the working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched and is not part of this package. Earlier handoff entries are unchanged. This package receives its own local P9 commit under the standing authorization.

### Implementation

- **OpenCode adapter:** `packages/providers/src/opencode.ts` drives `opencode run --format json --auto` from the child's `cwd` (no `--dir`), resumes with `--session <id>`, and detects the CLI major version: OpenCode 1 gets `--variant <effort>`, OpenCode 2 gets `provider/model#effort` (a `#` typed into the model field is replaced, not doubled). It captures the session ID as soon as it appears, maps text parts to messages, shell tool parts to command events (exit code and output tail), write/edit/delete parts to file events (read/glob/grep stay commands), and step-finish events to usage. If the final assistant message has no step-finish, it reads the session export — `opencode export <id>` with the v1 `{info, parts}` shape, or `opencode session export <id>` with the v2 `{type, content}` shape — and adds that message's tokens/cost; absent usage stays `null`, never zero. Abort/timeout kills the whole process group (SIGTERM, SIGKILL after 5 s). `opencodeError` classifies auth/quota/rate-limit/unavailable from stderr, exit or the v1/v2 error shapes.
- **Catalog and status:** `opencode` is a coding-only provider with `opencode auth login`, suggested `deepseek/deepseek-flash` and `deepseek/deepseek-v4-pro`, and an empty model meaning OpenCode's default. Settings reports `opencode --version` success as **Installed** (or the install/login help), and `JEEVES_OPENCODE_PATH` overrides the binary. `codingAgents` now branches to Codex or OpenCode; the fake-agent path is unchanged.
- **Reasoning effort:** the coding role accepts optional `low|medium|high|xhigh` in Settings (`PUT /settings/roles`), persists it, and passes it as `modelReasoningEffort` to Codex, `--variant` to OpenCode 1, or the `#variant` model suffix to OpenCode 2. Default remains unset (the provider's default). The Settings UI has a small select beside the Implementation model. OpenCode 2 with an empty model and a selected effort fails clearly instead of silently dropping the effort.
- **Settings simplification:** Connections comes first, one row per provider with a status badge, one-line help, and a mouse-copyable setup command (CLI logins are exact; API-key providers show the `export …=` prefix to complete). Models shows **Design model** and **Implementation model** (with effort), and the planner moved into an **Advanced** disclosure. No server actions were added. The e2e Settings journey uses the new labels, checks a Codex setup command can be copied, opens Advanced, saves the effort and passes axe.
- **Docs:** README provider table now lists OpenCode, its `opencode auth login` setup, `provider/model` model format, and the no-sandbox ownership guard; execution and `JEEVES_OPENCODE_PATH` text updated.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked **414 files** (137 warning-level / 57 info diagnostics, no errors), every workspace type check passed, **511 unit tests / 71 files passed (27.12 s)**. New tests cover OpenCode session/text/tool/resume/cwd mapping, v1 `--variant` and v2 `#variant`, v1/v2 usage export fallbacks, effort-without-model rejection, null usage, quota/auth/unavailable classification, process-group abort, provider status/coding source and reasoning-effort persistence over the API. Unit tests need no Docker, Postgres service or network.
- **Final browser:** `pnpm test:e2e --workers=2`: **24 passed (58.3 s)**, including the rewritten Settings journey (copy command, saved effort, Advanced) and axe.
- **`git diff --check`: passed.** No dependency or lockfile changes.
- **OpenCode preflight:** the PATH binary reports **v2.2.2**; the global npm package `opencode-ai@1.19.5` (the command the README names) is also present. Their `run --format json` text/tool/step events are the same; v1 uses `--variant` and `opencode export`, v2 uses `#variant` and `opencode session export`, and both are handled. `opencode auth list` shows a stored **DeepSeek** credential (plus others); `opencode models` lists `deepseek/deepseek-flash` and `deepseek/deepseek-v4-pro` for both versions. The custom `deepai` provider in `~/.opencode/opencode.json` is **not** loaded by either version from that path (it does not appear in `opencode models`); the built-in DeepSeek login works.
- **Raw JSONL smoke:** `opencode run --format json --auto --model deepseek/deepseek-flash` in a scratch directory produced 12 lines. The first 10 are reproduced below (long tool payloads are exact, not summarized):

```jsonl
{"type":"step_start","timestamp":1793378030544,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da913d0001PtEVf0H1VhogjP","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da90f3e001EHgsq6E8m5rtID","type":"step-start"}}
{"type":"text","timestamp":1793378030692,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da913d2001sasysATGqEthID","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da90f3e001EHgsq6E8m5rtID","type":"text","text":"I'll list the files first, then read hello.txt.","time":{"start":1793378030546,"end":1793378030692}}}
{"type":"tool_use","timestamp":1793378030703,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"partID":"prt_18da91419001hqiWDbhhHGmxI0","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da90f3e001EHgsq6E8m5rtID","type":"tool","id":"call_00_ET_HlHi45K6FNIv7LPElAdx6201","tool":"shell","state":{"status":"completed","input":{"command":"ls -la"},"output":"total 16\ndrwxr-xr-x 2 ash ash 4096 Oct 30 11:26 .\ndrwxr-xr-x 3 ash ash 4096 Oct 30 11:33 ..\n-rw-r--r-- 1 ash ash    3 Oct 30 11:25 hello.txt\n-rw-r--r-- 1 ash ash   19 Oct 30 11:26 made.txt\n","title":"shell","metadata":{"metadata":{"status":"completed","truncated":false,"exit":0},"content":[{"type":"text","text":"total 16\ndrwxr-xr-x 2 ash ash 4096 Oct 30 11:26 .\ndrwxr-xr-x 3 ash ash 4096 Oct 30 11:33 ..\n-rw-r--r-- 1 ash ash    3 Oct 30 11:25 hello.txt\n-rw-r--r-- 1 ash ash   19 Oct 30 11:26 made.txt\n"}],"providerCall":{"executed":false},"providerResult":{"executed":false},"rawInput":"{\"command\": \"ls -la\"}"},"time":{"start":1793378030617,"end":1793378030703}}}}
{"type":"step_finish","timestamp":1793378030705,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da91471001uM5VMUFiANBHim","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da90f3e001EHgsq6E8m5rtID","type":"step-finish","reason":"tool-calls","cost":0.000087492,"tokens":{"input":222,"output":50,"reasoning":0,"cache":{"read":8064,"write":0}}}}
{"type":"step_start","timestamp":1793378032208,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da91a50001N1KRynsPdCABnj","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91479001bEiP3bRBuMHzM3","type":"step-start"}}
{"type":"tool_use","timestamp":1793378032566,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"partID":"prt_18da91b5b0017VkS2a1N7I3i5G","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91479001bEiP3bRBuMHzM3","type":"tool","id":"call_00_nAqEPdFAWYqVTANVsiCl3131","tool":"read","state":{"status":"completed","input":{"path":"/tmp/opencode/p9-scratch/hello.txt"},"output":"Read file /tmp/opencode/p9-scratch/hello.txt, lines 1-1\n1: hi","title":"read","metadata":{"metadata":{"truncated":false},"content":[{"type":"text","text":"Read file /tmp/opencode/p9-scratch/hello.txt, lines 1-1\n1: hi"}],"providerCall":{"executed":false},"providerResult":{"executed":false},"rawInput":"{\"path\": \"/tmp/opencode/p9-scratch/hello.txt\"}"},"time":{"start":1793378032475,"end":1793378032566}}}}
{"type":"step_finish","timestamp":1793378032566,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da91bb6002LjMOumDpuQtom8","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91479001bEiP3bRBuMHzM3","type":"step-finish","reason":"tool-calls","cost":0.00009327599999999998,"tokens":{"input":246,"output":49,"reasoning":4,"cache":{"read":8192,"write":0}}}}
{"type":"step_start","timestamp":1793378033610,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da91fca001im5SaorgqxOtTt","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91bbb0015I5Ai58tNU3Lyw","type":"step-start"}}
{"type":"tool_use","timestamp":1793378034199,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"partID":"prt_18da9217b001025l0CvFLX8VM9","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91bbb0015I5Ai58tNU3Lyw","type":"tool","id":"call_00_2yZ5Oiz1U1uZri1ddgP76176","tool":"shell","state":{"status":"completed","input":{"command":"printf 'ok' > done.txt && cat done.txt && echo \"\" && ls -la done.txt"},"output":"ok\n-rw-r--r-- 1 ash ash 2 Oct 30 11:33 done.txt\n","title":"shell","metadata":{"metadata":{"status":"completed","truncated":false,"exit":0},"content":[{"type":"text","text":"ok\n-rw-r--r-- 1 ash ash 2 Oct 30 11:33 done.txt\n"}],"providerCall":{"executed":false},"providerResult":{"executed":false},"rawInput":"{\"command\": \"printf 'ok' > done.txt && cat done.txt && echo \\\"\\\" && ls -la done.txt\"}"},"time":{"start":1793378034043,"end":1793378034199}}}}
{"type":"step_finish","timestamp":1793378034200,"sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","part":{"id":"prt_18da92218001AgxlowhJ3BR8P9","sessionID":"ses_e7256f0e9ffez7ntbofvH0FYB2","messageID":"msg_18da91bbb0015I5Ai58tNU3Lyw","type":"step-finish","reason":"tool-calls","cost":0.00013536,"tokens":{"input":208,"output":56,"reasoning":76,"cache":{"read":8320,"write":0}}}}
```

- **Usage export:** for that session (`ses_e7256f0e9ffez7ntbofvH0FYB2`), `opencode session export` reported assistant turns summing to **924 input / 208 output tokens**, **33,024 cache-read tokens**, **80 reasoning tokens** and **cost 0.000410472**; the adapter's arithmetic matched that assistant-turn total. A separate real adapter call on v2.2.2 (`createOpenCodeAgent`, model `deepseek/deepseek-flash`, effort `high`, prompt "Reply with the word pong") returned `{ inputTokens: 4772, outputTokens: 3, cachedInputTokens: 4096, costUsd: 0.000729888 }` with session `ses_e7254b2aaffePergPZ0DycceGA`. The same adapter call through the npm v1.19.5 binary returned `{ inputTokens: 9524, outputTokens: 3, cachedInputTokens: 1664, costUsd: 0.001435392 }` with session `ses_e72464f3cffefG5pf5mtphAyPe`, proving the version-detected `--variant` path end to end.
- **Variant check:** `deepseek/deepseek-flash#high` works on v2 and `--variant high` works on v1; both were exercised by the adapter tests and real calls. `#medium` on v2 returns `provider.no-route: Variant unavailable for deepseek/deepseek-flash: medium`; the adapter surfaces that as a ProviderError rather than silently changing effort.

### Deviations, limits and next steps

- P9.2's wording says "for OpenCode pass `--variant <effort>`"; v1 does exactly that, while v2.2.2 has no such flag and selects the variant with `#effort` in `--model`. Both paths are implemented and tested.
- The OpenCode usage figure is the sum of assistant turns (stream step-finish plus the final assistant message from `session export`), not OpenCode's top-level `info.tokens`, which adds other input/cache fields. This keeps a resumed session from double-counting earlier turns.
- OpenCode status only checks that `opencode --version` works; it does not verify which provider/login is configured. A missing credential is reported by the first real run as an auth `ProviderError`, like Codex.
- The custom `deepai` provider was not validated because OpenCode 2.2.2 did not load it; use `deepseek/...` or move/fix the provider config before the qrwty run. DeepSeek Flash does not support the `medium` variant, so the P11 default should remain Codex `gpt-6.1-sol` at medium effort, or use OpenCode with `high`/provider default.
- No template, generator or qrwty code changed in this package.

**Next: P10 only**, in a fresh context. Read AGENTS.md, PLAN §15, the latest two handoffs and only the P10 section of `docs/build-plan.md`. Do not start P11.

---

## Improvements P10: Generate packs, env preflight, app URL and bootstrap (2026-10-30)

**Status:** P10 implemented. No coding-model run, qrwty implementation, QR-01–QR-09 execution or deployment was performed. The manual bootstrap wrote the reviewed fixture into `~/github/qrwty` and committed it; the baseline was not run (the plan's bootstrap uses `baseline:false`). The working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched and is not part of this package. Earlier handoff entries are unchanged. This package receives its own local P10 commit under the standing authorization.

### Implementation

- **Acceptance packs:** `apps/server/src/generate/acceptance-packs.ts` scans `fixtures/acceptance/<id>/manifest.ts`, validates the exported suites with the generator schema, and exposes only `{id, suites:[{id, acceptanceIds}]}`. `GET /generate/acceptance-packs` returns the list; `POST /projects/:id/generations` accepts `acceptancePack`, forwards the full reviewed suites as `fixedAcceptance`, and returns 422 `UNKNOWN_ACCEPTANCE_PACK` for an unknown id. Omitting it leaves the lock's existing suites alone. The Generate drawer has a **Fixed acceptance pack** select (None / qrwty), shows the suite ids and acceptance IDs it would register, and disables it while running.
- **Environment preflight:** Generate now has an `env` step between writing files and the baseline. It uses the P8 `missingComposeEnvironment` helper; missing `${VAR:?}` values fail that first step with `Missing required environment: <names>. Add them to <dir>/.env.` and stop before Docker. The drawer shows the env step failure; the run is not reported as a template bug.
- **App URL:** after a green baseline the generation report carries `appUrls`: a web app with a numeric `hostPort` gets `http://127.0.0.1:<port>`; otherwise the entry is the `docker compose port <element> 5173` hint. The drawer renders **Open the app** with the link or hint and says the baseline ran `docker compose down` afterwards (start with `docker compose up --wait`). `GET /projects/:id/generation` returns the same `appUrls` for Runs to use later.
- **Project output folder:** `PATCH /projects/:id` now accepts `outputDir` as well as `name`, so the bootstrap can point the project at `~/github/qrwty` without a Generate-only side effect.
- **Bootstrap rewrite:** `scripts/qrwty-bootstrap.ts` accepts `--output-dir` (default `~/github/qrwty`), `--api` (default `http://127.0.0.1:4310`) and `--public-origin` (default `http://127.0.0.1:5173`), asserts the origin matches the fixture's web `hostPort`, applies the design and layout through the operations API with a `designSchema.parse` round-trip comparison, PATCHes the output folder, merges `.env` **before** Generate (existing keys, including the DB password, are preserved), and runs Generate through the server with `{baseline:false, acceptancePack:"qrwty"}`. It only treats the target as a repository when `git rev-parse --show-toplevel` equals that folder (so a subdirectory of another repo cannot commit its parent). It removes the second in-process generation, reads `jeeves/lock.json` back for the six suites/nine cases, and commits `Generate qrwty template project (design revision N)` when the target was an existing dirty work tree.
- **Docs:** README's qrwty bootstrap section now documents the folder/flags, the server-owned generation, the `.env` merge, the existing `README.md`/`.docs` files, and the git-ignored `.env`.

### Commands and measured evidence

- **Final `pnpm check`: passed.** Biome checked the workspace (137 warning-level / 57 info diagnostics, no errors), every workspace type check passed, **514 unit tests / 71 files passed (24.42 s)**. New tests cover pack listing/forwarding/unknown ids, the env step failing before the baseline, both the hostPort URL and compose-port hint (plus overview), and `PATCH outputDir`. Unit tests need no Docker, Postgres service or network.
- **Final browser:** `pnpm test:e2e --workers=2`: **26 passed (1.0 m)**, including the qrwty pack selected through the native select (the control is mouse-operable; Playwright uses `selectOption` for a native `<select>`), generating the qrwty design without a baseline with six registered suites, and the drawer's mocked green-baseline app link. The real green-baseline URL/hint is covered by the server test.
- **`git diff --check`: passed.** No dependency or lockfile changes.
- **Manual bootstrap into `~/github/qrwty`:** `pnpm qrwty:bootstrap` printed:
  `Design revision 1; 0 finding(s), no errors.`
  `Wrote /home/ash/github/qrwty/.env (merged)`
  `Generation succeeded into /home/ash/github/qrwty.`
  `Lock has 6 fixed suites (activity, browser, core, qr-image, redirect, restart) covering 9 acceptance cases.`
  `Committed the generated qrwty project.`
  `git -C ~/github/qrwty status --short` is empty; `git log --oneline` shows `Generate qrwty template project (design revision 1)` on top of `Initial commit`; `.env` contains `DB_QRWTY_PASSWORD` (redacted) and `QRWTY_PUBLIC_ORIGIN=http://127.0.0.1:5173` and is git-ignored. A second bootstrap run left the `.env` SHA-256 unchanged (`27bec3…a1e`) and created no extra commit; a third run with a temporary `KEEP_ME=1` line preserved it and still created no commit, proving existing keys and the DB password survive.
- The bootstrap's baseline commit includes the repository's pre-existing untracked, empty `.docs/architecture-1.excalidraw` so the tree is clean; its contents were not changed, and `README.md` was left alone.

### Deviations, limits and next steps

- The plan called the step `env`; `GenerationStepId` gained that id in the server and web types. It is skipped when the baseline is off.
- App URLs are attached only after a green baseline; the bootstrap itself does not run the baseline, so the drawer shows them after the P11 UI Generate.
- The pack registry is repository-only and scans on request; there is no HTTP upload or pack editor. An unknown pack is rejected before any files are written.
- The bootstrap commits all uncommitted changes in an existing target work tree (`git add --all`) to leave a clean tree, as the P10 acceptance manual requires. `README.md`/`.docs` contents are not modified. A non-default `--output-dir` must itself be the repository root; a subdirectory of another repository is refused by the generator rather than committed into the parent.
- The layout is applied on every bootstrap (including reuse), so a missing or stale layout is repaired. `README.md`/`.docs` contents are never changed.
- No template, generator or qrwty application code changed in this package.

**Next: P11 only**, in a fresh context, with the user. Read AGENTS.md, PLAN §15, the latest two handoffs and the P11 section of `docs/build-plan.md`. Confirm provider credits first. Do not start the additive feature.

---

## Improvements P11: qrwty proving run (2026-10-30)

**Status:** P11 complete. The qrwty proving run (run **26**) succeeded with QR-01–QR-09 passing in the final attempt's checks. The app is merged to `main` in `~/github/qrwty` at `563c426` and running at exactly `http://127.0.0.1:5173`. No additive feature was started. The Jeeves working tree was clean on entry apart from the untracked review document `docs/reviews/`, which was left untouched. Earlier handoff entries are unchanged; this package receives its own local P11 commit under the standing authorization.

### Setup and baseline

- Settings: coding `codex` / `gpt-6.1-sol` / reasoning effort **medium**; design chat and planner remain Codex with their default model. `pnpm dev` served the API at `127.0.0.1:4310` and the web app at `127.0.0.1:4300`.
- `pnpm qrwty:bootstrap` reused the qrwty project, applied design revision 1, and generated into `~/github/qrwty` with the six fixed suites. `rm -rf ~/jeeves-projects/qrwty` removed the stale P6 output first.
- Generation **44** (baseline on, no pack override) was green: `generate`/`env`/`install`/`typecheck`/`compose-up`/`test-packs`/`behavior`/`compose-down` all passed, `appUrls` showed `http://127.0.0.1:5173`, the three extension operations were deferred application acceptance, and generated session/QR standard behavior passed. The drawer's app link is the real generation 44 report.
- The first baseline attempt (generation 43) failed the web-app sample-call check because `readSession` is session-protected. The fixed pack now parses OpenAPI `security` and `sampleCallFor` skips protected GETs; generation 44 passed. This was a P11 precursor fix, not a claimed earlier pass.

### Run 26

| Field | Value |
| --- | --- |
| Project / run | qrwty / **26** |
| Design | revision **1**, hash `538b792a3d59dfee94a9cd75accee20de0aa8d99283dfbd722db30409df7dfab` |
| Templates | http-service@0.1.0, postgres@0.1.0, rest-api-client@0.1.0, rest-api-server@0.1.0, web-app@0.1.0 |
| Starting commit | `93898e1b4b6d31b19505ddb436f87f816f648584` |
| Coding selection | Codex `gpt-6.1-sol`, reasoning effort **medium** |
| Mode | review-after-task (4 tasks, 9 acceptance IDs in capabilities) |
| Elapsed | 2026-10-30 19:06:01Z → 19:40:23Z, **34m22s** |
| Usage | **12,487,382 input / 83,501 output tokens**, known `false`; **cost unknown** (Codex reports no price); 12 usage records, 11 with tokens |
| Attempts | qr-image **5**, redirect **4**, activity **1**, qrwty-web **2** (12 total) |
| Merge | `563c426` (`Merge branch 'jeeves/run-26'`) on `main` |

Per task:
- `qr-image`: attempts 5. Three failed on the fixed-suite Node strip-only defect, one failed on the regenerated design hash, attempt 5 passed; usage 683,181+1,086,649+1,519,932+0+195,478 input and 5,830+6,747+7,612+0+788 output.
- `redirect`: attempts 4. Three failed on the fixed-suite destination-request expectations, attempt 4 passed; usage 376,893+673,519+827,078+1,108,621 input and 3,658+4,904+5,273+5,816 output.
- `activity`: attempt 1 passed; 458,176 input / 4,097 output.
- `qrwty-web`: attempt 1 failed, attempt 2 passed; 2,299,244+3,258,611 input and 16,662+22,114 output.

Final attempt acceptance (all passed):
`QR-01` core, `QR-02`/`QR-06` qr-image, `QR-03`/`QR-04`/`QR-07` redirect, `QR-05`/`QR-06` activity, `QR-08` restart, `QR-09` browser.
Earlier attempts correctly showed core and restart skipped while their operations were not yet required, and browser skipped until the frontend task; those skips carried their acceptance IDs and waiting reasons.

### Human interventions and fixes during the run

Nine timestamped interventions are in the run detail. Human-help entries:
1. The fixed support files `fixtures/acceptance/qrwty/_support/api.ts` and `destinations.ts` used TypeScript constructor parameter properties, which Node's strip-only TypeScript loader rejects. Replaced them with explicit fields, regenerated the generated-owned acceptance support/lock, preserved the agent's staged work, and resumed.
2. The redirect fixed suite expected the HTTP client to follow the 302 and contact the destination (`1`/`2` requests). A 302 never contacts the destination; corrected the protected assertions to `1`/`0` destination requests and the scan counts to 2/3, regenerated the test/lock, and resumed.
The remaining notes record the start, each review pause (qr-image, redirect, activity), and the resumes. The run's task branches and the harness fixes are committed on `jeeves/run-26` and merged as `563c426`; the Jeeves repository has the matching fixture/template fixes in this P11 commit.

### Final manual journey

After merging and `docker compose up --build --wait` (all three services healthy, `qrwty-web` on `127.0.0.1:5173`), a fresh browser session registered, created a QR (`56033e3e-aee6-486e-928b-872780406e2d`), selected it with `qr-select`, edited its destination, downloaded a **512×512** PNG, and saw the activity view. An independent jsQR decode of the downloaded image returned `http://127.0.0.1:5173/q/56033e3e-aee6-486e-928b-872780406e2d`; a manual `fetch` of that URL returned 302 to the edited destination `https://example.test/p11-edited`; the activity total was **1 request**; logout returned to the auth form; there were no unexpected console/page errors. The PNG is `/tmp/opencode/qrwty-p11-qr.png` and the screenshot is `/tmp/opencode/qrwty-p11-ui.png`. A physical phone scan and opening the loopback URL from another device were **not** performed by the agent; the PNG was decoded independently, and the phone/loopback check remains a human step.

### Checks and limits

- `pnpm check`: **515 tests / 71 files passed** (26.98 s), 137 warning-level / 57 info diagnostics, no errors. The P11 commit includes the support/redirect fixture fixes and the `security`-aware sample-call change.
- `git diff --check`: passed. The qrwty repository is clean on `main` after the merge; its `.env` stays git-ignored.
- Codex reported tokens but no dollar cost, so the usage ledger's cost is unknown, not zero. The retry counts (and 12.5M input tokens) are dominated by the two harness defects; future runs should not repeat them.
- The app binds to loopback, so a phone can scan the PNG on screen but cannot open `127.0.0.1:5173` from another device. The independent decode verifies the image content; the fixed QR-09 browser suite verifies the UI journey.
- The additive feature (candidate: optional campaign label and owner filter) is not approved or started. Any reuse of the completed work needs a fresh design/regeneration and independent acceptance per the P5 rules.

**Next:** agree the additive feature separately, then prove regeneration, preserved extension code and cumulative feature usage. Do not claim that feature yet.
