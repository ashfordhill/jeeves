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
