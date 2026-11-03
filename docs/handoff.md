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

---

## Product review: Jeeves UX, qrwty and proposed C4 direction (2026-10-30)

**Status: planning only, draft awaiting joint review.** This is not a completed S section or P implementation package. The user chose to polish qrwty first while extracting reusable Jeeves templates, focusing on QR management and analytics before maps/devices. No application source, dependencies, acceptance fixtures, migrations, provider configuration or generated project files were changed by this review. Existing uncommitted editor changes, their interaction test and the older readiness review remain untouched. No implementation package commit was created.

The deliverable is [the review and proposed roadmap](reviews/jeeves-qrwty-product-plan-2026-10-30.md), with current screenshots and proposed qrwty/Jeeves layouts under `docs/reviews/assets/2026-10-30/`. The review covers live Jeeves at `:4300`, qrwty at `:5173`, both codebases, the animated GIF, dropshipping's existing Cloudflare/MUI constraints, the supplied Educative article and linked primary architecture/framework documentation. During the earlier live inspection, one disposable qrwty review account and one example QR were created; those local review records remain. The final browser check was read-only.

Principal findings: the frontend scaffold leaves most product UX to the agent; complex resources/behavior are buried in a JSON inspector; architecture and implementation binding are conflated; a console-error assertion encouraged a Web Worker HTTP workaround; accepted qrwty behavior does not establish polished UX, low generation cost or release readiness. The proposal retains the generator, ownership protections and React Flow. It adds C4 model/view separation, explicit component responsibilities, structured screen/data/behavior editors, finite reusable UI patterns and versioned behavior recipes. Executable container connections remain outer-only; component projections do not duplicate generated wiring. Existing qrwty data and public QR identities must survive adoption/regeneration.

Proposed order, **not approved implementation scope**: agree screen/state criteria and correct harness assumptions; polish qrwty; reproduce it with templates; expose those choices in Jeeves's model/editor; prove an agreed additive feature with usage evidence; then release/scale and target-specific expansion. The draft does not supersede `docs/improvements.md` or assign new P IDs. That file's opening status is stale relative to the P11 completion evidence; reconcile it when approving the next specification.

Verification evidence from this review:

- `pnpm typecheck`: passed; `pnpm test`: **71 files, 515 tests passed**, 28.26 s. These were run during the initial review and were not repeated after documentation-only edits.
- `pnpm exec playwright test apps/web/e2e/editor-interactions.spec.ts --reporter=line`: **2 passed (5.4 s)**. Its output includes a ResizeObserver error despite passing; the draft records that limitation.
- `pnpm check`, including the final rerun: **failed at lint**. Final output: `Checked 419 files ... Found 1 error. Found 137 warnings. Found 57 infos.` Error-only Biome confirms `docs/examples/qrwty.svg:2:1 lint/a11y/noSvgWithoutTitle`. No baseline fix was made during planning, and no green combined gate is claimed.
- `pnpm exec biome check docs/reviews/assets/2026-10-30 --diagnostic-level=error --max-diagnostics=10`: **2 files checked, no fixes applied**; both concept SVGs pass. SVG XML/title checks and local Markdown-link validation also pass.
- Final Chromium read-only check: both live apps returned **200** with expected content; both concepts rendered without out-of-bounds text and were visually inspected. Earlier sampled axe states reported zero violations; this is not a full accessibility/usability audit.
- `git diff --check`: passed. No new paid model runs, deployment, full Docker conformance or physical phone/device tests were performed. Full review logs remain in `/tmp/jeeves-ux-review/`.

**Next:** review the qrwty layout/product contract, deterministic recipe boundary, C4 connection policy and proposed M0–M4 order with the user. Only after agreement, convert the accepted scope into bounded P-package specifications and reconcile the already pending editor fixes. Do not infer implementation authorization from this draft or start maps/devices/dropshipping adoption.

---

## Product review follow-up: public qrwty identity, QR Studio and growth (2026-10-30)

**Status: plan refined; no implementation authorized or started.** The user clarified that `https://qrwty.io/` establishes the product direction: visually appealing QR customization and analytics, with reusable templates extracted for other web apps. They also want horizontal/vertical scaling to be planned for large traffic. This supersedes the earlier draft's narrow first milestone of polishing only the existing QR management screens; maps/devices still remain later work.

- Inspected the public page with a read-only Chromium session at desktop/mobile widths (HTTP 200); captured its dark blue themes, QR preset gallery, PNG/SVG controls, scanability advisor, hosted/self-hosted positioning and a PoC Unique counter. No public form submissions, accounts, links or waitlist records were created. Web extraction could not open the site; the direct browser inspection succeeded. Public UI presence was not treated as backend acceptance.
- Updated [the main roadmap](reviews/jeeves-qrwty-product-plan-2026-10-30.md) and added [Studio/scaling detail](reviews/qrwty-studio-and-scaling-2026-10-30.md). Added the dark blue [Studio concept](reviews/assets/2026-10-30/qrwty-studio-concept.png) and retained the earlier green library concept as an information-layout study, explicitly superseded for brand direction.
- The first milestone now includes saved artwork revisions, bounded styling/presets, preview, PNG/SVG export, asset handling and independent scanability checks. Link identity remains separate from artwork revision: destination-only edits preserve a fixed revision's bytes and old printed URLs. New mutation/export contracts are required; the current GET-only custom-extension schema cannot express the whole Studio. Generic editor/preset/media components are separated from QR domain rendering.
- Growth boundaries are planned from the start: management, redirects, rendering, durable intake and analytics workers/queries. M2 gains a real two-instance ingress/session/drain proof and capacity controls with database connection budgets. The supplement describes compact and growth profiles, cache consistency, deduplicated event processing, hot-link contention, synthetic workload scenarios and proposed benchmark targets. No scalability benchmark was run or throughput claimed.
- The existing durable-event-before-302 contract remains in force. Redirect availability during an intake outage is the proposed growth preference, but its incomplete-count semantics need explicit review before changing acceptance. Public Unique labels, hosted billing/license enforcement, deployment provider and exact capacity budgets remain unapproved product decisions.
- Verification: all three review SVGs pass targeted Biome after adding an accessible label to the nested example QR; Studio rendered in Chromium at 1500×1080 with no out-of-bounds text and was visually inspected. The preview QR uses a reserved `.example` URL and is a planning asset. Application code and qrwty's Git tree remain unchanged; the previous full-check failure is still the recorded baseline. No unit/browser application suites were repeated for documentation-only changes.

**Next:** review the Studio flow/preset scope and the growth profiles, especially event-intake failure behavior, then incorporate accepted decisions into bounded implementation packages. Continue planning until the user authorizes implementation. Preserve all earlier handoffs and pending editor work.

---

## Execution handoff preparation: reliability policies and P12 (2026-10-30)

**Status: next execution prompt/specification prepared; no application implementation performed.** The user clarified that enterprise reliability mechanisms belong in reusable Jeeves components/templates with visual choices and recommended defaults. They then said they were ready to begin executing and requested a prompt for a fresh chat, intending to use medium reasoning effort to reduce usage.

Added section 7 to [the Studio/scaling supplement](reviews/qrwty-studio-and-scaling-2026-10-30.md#7-reliability-is-a-reusable-visual-capability): reliable analytics, transactional business events/outbox, regional resilience, backup/restore and dependency-protection profiles. It distinguishes delayed durable events from unaccepted events, live replication from recovery backups, and routine consumer/node outages from exhaustion of every capture path. The inspector should select outcomes/presets and expand into actual supported runtime/deployment configuration and failure conformance, with advanced overrides. These are planned capabilities, not claims about the current generator.

Prepared [docs/build-plan-next.md](build-plan-next.md) as the bounded **P12 — browser verification correctness** specification and updated the active status in `docs/improvements.md`. P12 addresses the browser HTTP/console classification defect, removes overly broad fixed-suite error filtering, proves normal fetch works without a Worker in disposable fixtures, and fixes the existing example SVG title lint blocker. It explicitly preserves current qrwty code/data, protected QR behavior and all pending editor/review work. Studio/C4/reliability implementation follows in separate packages; the user did not request implementing the full roadmap in one fresh chat.

No application tests were rerun for this documentation-only handoff. Prior recorded baseline remains: 515 unit tests and type checks passed; the combined gate failed on the missing title in `docs/examples/qrwty.svg`, now explicitly included in P12. Preparation validation: local document links resolve and `git diff --check` passes. No commits, paid model runs, deployments or live application changes were made in this preparation.

**Next: implement P12 only**, following `AGENTS.md`, `PLAN.md §15` and `docs/build-plan-next.md`. After scoped checks, append the P12 implementation handoff, commit only P12 changes with a `P12:` title, and stop. Preserve all earlier handoff entries and do not stage pre-existing review/editor changes merely because they are in the working tree.


---

## Improvements P12: browser verification correctness (2026-10-30)

**Status: P12 complete.** Implementation follows the bounded scope in `docs/build-plan-next.md`. The pre-existing Draw Jeeves edits, interaction spec, draft reviews, improvement-plan update and earlier uncommitted handoff additions are preserved and excluded from this package's commit. Live qrwty remains unchanged, including its Worker transport, data and QR URLs. No paid agent runs, live regeneration or subsequent package work was performed.

### Implementation

- Added one self-contained browser observer shared by the template-kit wrapper and the fixed qrwty acceptance suite. It records HTTP responses and transport failures with method/URL/status or error evidence, plus uncaught exceptions, unhandled rejections and application console errors. Chromium's native resource diagnostics are reconciled only when they have no JavaScript arguments and match observed network evidence; application messages with identical text and uncorrelated diagnostics still fail. No blanket 4xx, resource-message or favicon exclusion remains.
- Expected negative responses match an exact method, full URL (origin/path/query), fetch/XHR resource type and status, bind to a request started inside the scenario, and permit one request. Required expectations fail when unexercised; wrong statuses, earlier/later/repeated requests and mismatches remain failures. Explicit cancellation expectations recognize `net::ERR_ABORTED`; unanticipated aborts and other transport errors fail.
- Web-app page-load/runtime-config checks permit one initial anonymous `readSession` probe per connected structured session API. This probe is optional only because unfinished scaffolds need not implement it; once started its 401 must match. This generic load check does not claim auth acceptance. The sample-call page remains strict. QR-09 requires the initial session 401 and visible auth form, closes that expectation before registration, and checks network/page/console failures across the remaining journey without changing QR-01–QR-09 business assertions.
- The fixed-suite manifest copies the shared helper verbatim into generated-owned `_support/page-problems.ts`; a local alias serves the source fixture. An isolated generated-project test verifies the protected hash, copied contents and actual Node strip-only import/execution without workspace dependencies.
- Added a disposable loopback HTTP fixture using ordinary window fetch with no Worker. Chromium cases cover signed-out/validation success, wrong route/status, unexpected 401/403/404/500, broken script/favicon assets, transport failure, uncaught exception/rejection, application errors including imitated native messages, missing coverage and deliberate/unexpected cancellation. Added focused offline classification unit tests. The SVG fix is one accessible `<title>` in `docs/examples/qrwty.svg`.

### Commands and results

- `pnpm --filter @jeeves/template-kit --filter @jeeves/template-web-app typecheck`: passed.
- `pnpm exec vitest run packages/template-kit/src/page-problems.test.ts packages/generator/src/qrwty.test.ts`: **23 tests / 2 files passed** (892 ms), including isolated fixed-support loading.
- `pnpm exec vitest run --config vitest.templates.config.ts templates/web-app/conformance/browser-problems.conformance.ts`: final run **19 passed** (13.11 s). The initial run passed 15 and failed 4 due to two fixture defects: missing `model.extensions`, and headless Chromium omitting automatic favicon requests. Fixed the model and explicitly loaded the missing favicon as an image; the final good case also asserts that native 401/400 diagnostics really occurred and that no Worker was created.
- `pnpm exec vitest run --config vitest.templates.config.ts templates/web-app/conformance/web-app.conformance.ts`: **15 passed** (64.52 s), using disposable generated apps/containers, including client calls, proxy recovery and generated type checks.
- `pnpm check`: **passed**, **535 tests / 72 files** (29.86 s unit run), all workspace type checks passed, Biome checked 424 files with **137 warning-level / 57 info diagnostics and no errors**. Full output: `/tmp/jeeves-p12-check.log`.
- Scoped Biome formatting/checks and `git diff --check`: passed. Reviewed the implementation diff and staged scope; only this appended handoff entry is included in P12. qrwty's Git working tree is clean.

### Limits and next bounded work

This proves the normal-fetch browser policy in Chromium and the required generated web-app conformance; it is not a fresh full QR-01–QR-09 live proving run. Existing lint warnings/info diagnostics remain. The current qrwty Worker is deliberately retained; removing it requires a later controlled application adoption with its own regression checks. Headless favicon coverage uses an explicit asset request because automatic icon fetching is browser-dependent. No cloud, reliability runtime, Studio, C4 or schema work is included.

**Next bounded package:** reconcile the already pending Draw Jeeves placement, subtype/control and camera changes with their `editor-interactions.spec.ts` acceptance, review their scope and verification, then hand off/commit them separately. Separately specify the first bounded qrwty product package around the branded Studio/product direction and reusable template boundary, preserving stable QR identity, data and ownership plus the planned visual reliability policies. Do not infer implementation authorization for the broader roadmap from this handoff. Stop after P12.


---

## Improvements P13: editor interaction reconciliation (2026-10-30)

**Status: complete.** The user authorized continuing implementation toward polished qrwty, deterministic reusable enterprise components and C4-informed Jeeves, superseding the earlier P12-only stop. They also required a final original-plan/C4 and UI/UX comparison against Excalidraw and automation-pitch, including its `VISUAL_IMPROVEMENTS.md`. This direction and P13's bounded specification are recorded in `docs/build-plan-execution.md`. Each following package still requires independent checks, handoff and local commit.

### Implementation

- Reconciled the previously pending Draw changes: empty-space placement, card hit testing for drops, tool-gated movement/connection/reconnection/control activation, mouse-accessible cancellation, stable selection geometry and fitting the diagram when the inspector reduces available width. Service controls and annotation resize handles are active only in selection mode; frame interiors remain valid placement surfaces. Cancel also clears the placement notice.
- Removed the pending subtype fieldset's click propagation block after existing inspector tests showed it prevented normal card selection. Retained the disabled controls and pointer handling that prevent accidental edits in creation mode. Added annotation/frame coverage to the existing pending interaction specification.
- Fixed Playwright's viewport configuration: the Desktop Chrome device preset had overridden the intended 1440×900 viewport with 1280×720, clipping a test card behind the board controls. The explicit viewport now follows the preset; per-test viewport overrides remain available.
- Added a shared strict browser fixture to the interaction, draw, resource-editor and inspector suites. It uses P12's network/console/page-error observer and also captures native window error events across navigation. The inspector's deliberately stale revision has one exact, required POST/409 expectation; unexpected errors are never filtered.
- Traced the previously ignored ResizeObserver errors to React Flow's synchronous node-internals update during native observer delivery, reproducibly during mouse resizing. Deferring only the app's controlled callback did not fix the upstream internal-store write, so that experiment was removed. A narrow pnpm patch to the existing pinned `@xyflow/react@12.11.6` coalesces the upstream node measurements into the next animation frame and cancels pending work on cleanup. Both used ESM entry points are patched; versions and all other dependencies are unchanged. `patches/README.md` records the reason, scope and removal gate. No global observer replacement or error suppression remains.

### Commands and results

- Initial focused pending interaction baseline: **2 passed**. Broad acceptance then exposed the viewport/selection regressions and reproduced the native resize errors; strict window-error capture converted the silent warning into a failure.
- Temporary disposable resize tracing identified the synchronous upstream observer. Diagnostic test/instrumentation and the ineffective app-level scheduling experiment were removed before final checks.
- `pnpm exec playwright test apps/web/e2e/editor-interactions.spec.ts apps/web/e2e/draw.spec.ts apps/web/e2e/resources-editor.spec.ts apps/web/e2e/inspector.spec.ts --workers=1 --reporter=line`: **12 passed (35.2 s)** with strict network, application and native-window-error checks. Includes mouse resize, subtype review, persistence, connections, conflicts and axe checks. Output: `/tmp/jeeves-p13-e2e.log`.
- `pnpm exec playwright test apps/web/e2e/editor-review.spec.ts apps/web/e2e/chat.spec.ts apps/web/e2e/generate.spec.ts apps/web/e2e/runs.spec.ts apps/web/e2e/shell.spec.ts --workers=1 --reporter=line`: **17 passed (1.3 min)**. Run because the dependency patch and viewport affect shared setup; all providers/checks use the existing fake test configuration. Output: `/tmp/jeeves-p13-e2e-remaining.log`.
- `pnpm check`: **passed**, **535 unit tests / 72 files (27.83 s)**; all type checks passed; Biome checked 425 files, **137 warnings / 57 infos and no errors**. Output: `/tmp/jeeves-p13-check.log`.
- Scoped formatting, final diff review and `git diff --check`: passed. pnpm patch application passed its existing supply-chain checks. No paid model run, live qrwty regeneration/data change, cloud deployment or unrelated review-document staging occurred.

### Limits and next work

The React Flow compatibility patch must be reassessed on dependency upgrades; the CommonJS/UMD bundle is unused by this ESM workspace and unchanged. Existing lint and React Flow attribution console warnings remain. P13 is editor correctness, not the final visual/product or C4 completion review. Earlier uncommitted review/planning documents and handoff additions remain preserved outside this commit.

**Next: P14, qrwty session/shell/library product foundation.** Inspect qrwty's project-owned source and contracts, define the bounded product acceptance, implement a branded navigable account/library experience using existing contracts, extract reusable deterministic UI behavior, and verify adoption with disposable fixtures while preserving QR URLs/data and generated-file ownership. Continue sequentially under the user's ongoing authorization; do not conflate a polished first screen with completed Studio, C4 or enterprise reliability capability.


---

## Improvements P14: qrwty session, shell and library foundation (2026-10-30)

**Status: complete.** Implemented the bounded P14 specification in `docs/build-plan-execution.md` under the user's ongoing product/C4/deterministic-template authorization. The qrwty project changes are committed separately as **`2c350f0`**, `P14: build the qrwty session and QR library workspace`. The live local frontend at `:5173` now displays this slice. Earlier uncommitted review/planning/handoff work remains outside this package.

### Implementation and ownership

- Built a responsive dark-blue qrwty account and library workspace: branded navigation, clear create/library sections, selected link management, clipboard confirmation, explicit server-image preview, contextual loading/empty/retry/error states and readable phone layouts. Existing create/edit/pagination/download/activity contracts, public URLs and QR-09 hooks remain intact. There are no inactive Studio controls or invented global analytics/search totals.
- Fixed failed logout incorrectly clearing local state. Session-check failure has its own retry view; signed-out and invalid-login states remain explicit. Deferred initial effect work avoids duplicate requests from disposed StrictMode mount effects. List generations and mounted-state guards prevent stale pages and old-session mutations from overwriting or signing out the current workspace; selected detail requests also respect unmounts.
- Removed the project-owned Worker transport. All calls now use the generated client's normal fetch. Browser verification exposed the existing openapi-fetch 204 response path leaving its stream unread; reproduced this against a real loopback HTTP server, then made logout finish `response.arrayBuffer()` before clearing session state. No browser errors are filtered or suppressed. The protected runtime artifact is unchanged; generalizing this cleanup into a later runtime version remains follow-up work.
- Added `@jeeves/product-ui@0.1.0` with responsive shell/navigation, page header, status/error feedback, empty state, scoped theme tokens and skip navigation. An unrelated inventory consumer verifies the domain-independent surface. Workspace imports use TS source; consumers receive compiled ESM/declarations/CSS in an immutable artifact. qrwty adopts that artifact under its project-owned frontend `artifacts/`, with package/Dockerfile wiring; its protected `vendor/jeeves/` is untouched. Artifact SHA-256: `07500c88b206d2192e65a78efbbb330ddad1205ba3a87adb3adaf366655125ac`.
- Supplemental browser workflows now use a verbatim P12 observer copy, exact required negative scenarios and a zero-Worker assertion. A real local HTTP fixture replaces route interception. Tests cover session/retry, invalid login/create/range, missing QR, expiration, failed logout, pagination, stale pagination after creation, old-session mutation completion, edit/title clearing, server download bytes, copy/preview, responsive navigation, empty states and axe checks.
- Added `packages/generator/scripts/verify-qrwty-product.ts`, included in generator type checking. It copies a consumer without environment credentials, verifies generated integrity, builds isolated Compose fixtures and runs current frontend tests plus existing protected business acceptance. The current strict QR-09 journey is supplemental; the consumer's old generated tests/lock are never hand-edited. Fixture cleanup removes containers, volumes, local images and temporary copies.

### Verification and visual evidence

- Jeeves `pnpm check`: **536 tests / 73 files passed (27.58 s)**; all type checks passed; Biome checked 433 files with **137 warnings / 57 infos, no errors**. Log: `/tmp/jeeves-p14-check.log`. The subsequently added adoption script and tsconfig inclusion passed focused Biome and `pnpm --filter @jeeves/generator typecheck`, then actual composed execution.
- qrwty `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm --filter qrwty-web build`: **passed**. **29 service tests / 3 files** and **11 Chromium workflows / 1 file**; frontend run 9.72 s. Final type checks passed after formatting. Logs: `/tmp/qrwty-p14-{install,typecheck,test,build}.log` and `/tmp/qrwty-p14-final-typecheck.log`.
- `pnpm --filter @jeeves/server exec tsx ../../packages/generator/scripts/verify-qrwty-product.ts /home/ash/github/qrwty`: **passed**. Four current web-app checks (page load, routes, runtime config, sample call); one current strict QR-09 journey; eight protected suites (standard sessions/resource plus core, QR image, redirect, activity, restart, browser), covering **QR-01–QR-09**. Both isolated databases were removed. Log: `/tmp/qrwty-p14-adoption.log`.
- Inspected desktop/phone screenshots and axe results. No axe violations or horizontal overflow in tested states. [Evidence and reproduction](evidence/p14/README.md) contains four screenshots and command details. The final visual recapture selected two tests: **2 passed**, nine intentionally unselected cases had already passed in the full run. This is product-slice evidence, not the final original-plan/C4 or Excalidraw comparison.
- Local adoption: `docker compose up -d --no-deps --build --wait qrwty-web` passed. Read-only Chromium verified the live signed-out screen, exact session 401 and zero Workers. The existing API/database container IDs were unchanged. All **32 generated-owned hashes** were checked unchanged; no live migration, QR data change, public deployment or paid model run occurred. The unrelated older `:5174` stack was not touched.
- Reviewed both scoped diffs and ran `git diff --check`. qrwty is clean after its commit. Only this new handoff entry is staged in Jeeves; the earlier 52-line review/preparation addition and other pending review documents remain preserved outside P14.

### Limits and next package

The shell is extracted and versioned, but automatic product-recipe generation has not yet been implemented. Navigation currently targets library/create sections; QR Studio, immutable artwork revisions, owner-wide analytics, C4 model/views and tested reliability presets remain outstanding. No broad enterprise-readiness or scan/print reliability claim is made. Existing lint warnings remain. Initial diagnostic failures (StrictMode duplicate probes, unread 204 stream, axe requiring explicit browser contexts, and Chromium coalescing identical pending GETs) were resolved in application/fixture code rather than suppressed. The stale-result test uses pending pagination against a distinct URL to exercise a real concurrent refresh.

**Next: specify P15 around immutable QR artwork/Studio contracts and deterministic rendering**, preserving existing public IDs, legacy PNG behavior and generated ownership. Inspect resource/extension/migration capabilities before selecting the bounded schema and adoption mechanism. Continue sequentially toward the user's full product/template/C4 goal; do not treat this first polished workspace as completion. The final review must still inspect the remainder/current automation-pitch UI and `VISUAL_IMPROVEMENTS.md`, compare Excalidraw, reconcile PLAN with intentional C4 design, and measure deterministic versus model-dependent delivery.


---

## Improvements P15: validated Studio foundations (2026-10-30)

**Status: complete.** Inspection showed that immutable artwork required bounded settings and mutation contracts absent from the GET-only/text-URL-timestamp model. The P15 specification in `docs/build-plan-execution.md` therefore separates those foundations and the renderer from P16's qrwty adoption/UI. P15 changes Jeeves only; qrwty remains clean at `2c350f0`, running the verified P14 frontend. No live generation, migration, paid agent run or deployment occurred.

### Implementation

- Added bounded 32-bit integer fields and finite enum tokens to the resource vocabulary, strict input/output JSON schemas, generated descriptors and SQL CHECK constraints. Generated standard acceptance supplies typed values and rejects out-of-range/fraction/string quantities and invalid enums. Nullable/optional behavior remains explicit. Stable IDs preserve physical table/column identity through names changing; existing integer-bound or enum-membership changes require reviewed migration, including widening. Newly added optional fields/resources remain additive.
- Added owner-only POST extension commands with required strict JSON object bodies. GET bodies, public POST and undeclared methods remain unsupported. Generation emits the selected method/body and standard error responses into OpenAPI; typed clients accept the valid command and reject wrong quantity/enum types. Existing session/Origin/CSRF guards already protect these mutations; focused tests now prove they run before dispatch. The extension still owns row authorization and must put its principal in the SQL predicate. Standard-operation overrides remain prohibited.
- Bumped the REST runtime artifact to **`@jeeves/rest-server@0.2.0`** for the widened descriptor interface. Existing template IDs remain compatible; newly generated bindings select the new artifact. No existing qrwty runtime tarball was overwritten. Updated exact artifact expectations and the intentional golden lock/agent-guide output. The guide explains command/body/owner/migration boundaries.
- Added **`@jeeves/qr-artwork@0.1.0`**, renderer ID **`qr-artwork@0.1.0`**, with separate browser-safe settings exports. It pins qrcode 1.5.4, pngjs 7.0.0 and jsQR 1.4.0. Four presets and strict settings support foreground/background colors, square/rounded modules and finders, 256/512/1024px output, quiet zone 4–8 and M/Q/H correction. Conservative dark-on-light contrast and actual module-pixel limits reject unsupported combinations.
- PNG and static accessible SVG share deterministic integer-pixel geometry. Every render independently decodes its PNG raster and verifies the canonical public URL. The API takes no mutable destination. Results include bytes, MIME, SHA-256, renderer version and measured checks. Golden reference hashes pin 0.1.0 outputs; consumers must retain the version or issued bytes when upgrading. The legacy qrwty 512px PNG endpoint remains unchanged.

### Commands and results

- Focused schema/command/migration tests: **28 passed / 3 files**. Renderer/schema first run: **27 passed / 2 files**. These proved strict input types, unsupported-command rejection, auth/CSRF/Origin and owner denial before mutation, protected handler ownership and conservative migration boundaries.
- `pnpm check`: **565 tests / 76 files passed (29.47 s)**; all type checks passed; Biome checked 445 files with **166 warnings / 63 infos, no errors**. Log `/tmp/jeeves-p15-check.log`. A subsequently added immutable reference-vector test passed in the final **19-test renderer run (1.21 s)**, with focused final lint/type checks. No production code changed after the combined gate.
- `pnpm exec vitest run --config vitest.templates.config.ts packages/generator/conformance/resources.conformance.ts templates/rest-api-server/conformance/rest-api-server.conformance.ts`: **17 passed / 2 files (136.71 s)**. Actual generated applications/clients compiled; typed resource and POST operations executed through HTTP/Postgres; invalid values failed both HTTP validation and direct SQL constraints; cross-owner commands failed; persisted settings survived restart; additive regeneration retained custom work and data. Log `/tmp/jeeves-p15-conformance.log`.
- `pnpm exec vitest run --config vitest.templates.config.ts packages/qr-artwork/conformance/svg.conformance.ts`: **12 passed (2.42 s)**. Chromium rasterized each exported preset at every supported size; jsQR independently decoded the actual screenshots. Strict browser observer found no unexpected failures. Log `/tmp/jeeves-p15-svg.log`.
- Renderer unit coverage includes all presets/sizes, M/Q/H across the matrix, all module/finder pairs, unchanged quiet borders, 90-degree rotation with 15% white blending, invalid settings and deterministic PNG/SVG hashes. `pngDecode` explicitly refers to the PNG raster, including SVG exports; SVG browser conformance is separate evidence.
- `pnpm --filter @jeeves/qr-artwork pack --pack-destination /tmp/jeeves-p15-artifacts`: passed. An isolated `/tmp/jeeves-p15-consumer` installed the compiled tarball offline and imported both main/settings entry points without the Jeeves workspace; the reference PNG hash matched. Updated intended goldens with the focused plan test (46 passed), then reviewed their changes.
- Final scoped lint/type checks and `git diff --check`: passed. Dependency installation used existing pinned versions; reported React 19 versus older Radix peer ranges were already in the web dependency graph, not introduced by the renderer. qrwty's Git tree remains clean. Existing review/planning/handoff additions stay outside P15.

### Limits and next work

No logos, arbitrary artwork, physical print/device matrix or universal scan guarantee is claimed. The 7:1 contrast and three-pixel minimum are conservative component policies, not QR-standard guarantees. The four-module margin follows DENSO guidance; source links and exact evidence limits are in `packages/qr-artwork/README.md`. Saved revisions, immutable artifact storage/adoption and the Studio UX are not implemented yet. Integer/enum constraint widening conservatively requires explicit migration review. Existing warning-level lint diagnostics remain.

**Next: specify and implement P16, qrwty immutable artwork revisions and QR Studio.** Adopt the new generated contracts and additive resource migration in disposable copies first; preserve every existing QR ID, legacy image behavior, public origin and project-owned feature. Build preset/configuration/preview/save/export flow and a generic editor primitive proved against a non-QR fixture, with honest draft versus saved states. Then continue owner analytics, deterministic recipe generation, C4/structured configuration and tested reliability presets, followed by the required original-plan/Excalidraw/automation-pitch UI review.


---

## Improvements P16: repeatable work and architecture reference library (2026-10-30)

**Status: complete.** The user's overnight instruction added source-based enterprise application research, recurring-work automation and a lighter verification strategy. P16 takes that prerequisite slot; the previously proposed Studio package is now P17. Continue product/template/C4 implementation without waiting for feedback. No model-provider call, upstream runtime installation, live qrwty generation, migration or deployment occurred.

### Implementation

- Added `pnpm work list|status|run` with named check/typecheck, selected unit/conformance/browser and disposable qrwty profiles. Commands use argv without a shell; selections require existing repository files or explicit `all`. Empty/unmatched test selections cannot silently pass. Complete logs and atomic JSON reports live under ignored `.jeeves-work/runs/`, with command/exit status, timings and before/after HEAD/diff/status/untracked-content fingerprints. Reports never skip a check or claim that an old result proves current behavior.
- Added `pnpm references list|fetch|verify` and 33 selected implementation/license files across Medusa, Payload, Umami, Zulip and Backstage, pinned by full commit and SHA-256. Offline verification and cache reuse need no network; mismatches fail. No upstream code was incorporated into Jeeves or generated projects. `docs/reference/enterprise-architecture.md` records actual seams, tradeoffs, concrete configuration/extension contracts, C4 responsibility mappings, proving consumers and proposed maturity.
- Found and recorded Medusa's explicit proprietary Enterprise RBAC/SSO boundary; selected shared workflow/event infrastructure remains a pattern reference. Other concrete lessons include authorization/query composition and transaction context (Payload), aggregate/query separation (Umami), after-commit versus durable-publication distinctions (Zulip), and stable catalog identity/relationships versus C4/generation semantics (Backstage). These references are not claims of perfect architecture or stable dependency releases.
- Made the existing qrwty verifier propagate cancellation to its subprocesses/Compose work and preserve uncancelled teardown. The runner invokes that verifier directly under Node so it can finish its cleanup. Other runners retain their existing cleanup semantics; hard kills/daemon failures still require inspection. README status now reflects P11–P15 rather than claiming qrwty has never been demonstrated.
- Documented repeatable commands and the user's verification preference in `docs/developer-workflow.md` and the package plan. Keep focused changed-behavior checks and the required offline gate; defer exhaustive configuration, load/soak/chaos/recovery/security certification campaigns. Record unverified claims and model-owned seams honestly. Scripts were sufficient; no extra MCP server or skill was needed.

### Verification

- `pnpm work run check`: **passed**, 566 tests / 76 files, Vitest 26.25 s; complete gate 31.3 s. All workspace and new script type checks passed; Biome had no errors. Log/result: `.jeeves-work/runs/2026-10-31T04-14-00-402Z-check-62479e64.{log,json}`. Source fingerprints were unchanged during the run.
- Selected existing command-schema and non-QR ProductShell tests through the runner: **10 passed / 2 files**, Vitest 577 ms. This verifies both `.test.ts` and `.test.tsx` selectors. Script and generator focused type checks passed before the gate.
- Disposable probe `/tmp/jeeves-p16-probe.mjs`: passed invalid/empty/traversing selection rejection; real exit-7 failure and subsequent-command short-circuit; untracked-content fingerprint changes; SIGTERM reaching a child cleanup handler and yielding an interrupted result; offline source cache reuse and rejection of missing/corrupt files. No broad new test suite was added for this tooling slice.
- Actual `qrwty-product` invocation interrupted during disposable Compose build: **interrupted as expected**, teardown completed, no `jeeves-product-*` containers remained, live container IDs and both repository fingerprints unchanged. Result `.jeeves-work/runs/2026-10-31T04-13-28-856Z-qrwty-product-83d38e21.json`. This is cancellation evidence, not a newly completed full product acceptance run; P14's full adoption evidence remains applicable to unchanged product behavior.
- `pnpm references fetch all` and `pnpm references verify all`: **five references / 33 files passed**; the verify run downloaded zero files. Diff and whitespace checks passed. No dependency versions changed.

### Limits and continuation

The component catalog is research/proposals; it does not add executable commerce, CMS, realtime or outbox templates. Working-tree fingerprints do not capture environment/services/dependency installation. The runner does not automatically infer all relevant checks. Existing lint warnings remain, and no bug-free or enterprise-readiness claim is made. Earlier 52-line handoff additions, review/planning files and improvements edits remain preserved outside the scoped commit. A newly observed untracked `business-analysis/` directory in the qrwty checkout is unrelated and untouched.

**Next: P17, immutable artwork revisions and qrwty Studio adoption**, preserving legacy exports/public QR identity and generated-file ownership. Specify the additive model/commands, bounded history and idempotent saving; prove migration/export/authorization boundaries in disposable fixtures, reuse the P15 renderer and P14 product shell, and expose a usable preset/settings workflow with focused checks. Continue to owner analytics, deterministic recipes, C4/configuration and selected enterprise components. The final original-plan and Excalidraw/automation-pitch visual/interaction review remains required.

## P17 — saved artwork and QR Studio (2026-10-31)

Implemented the bounded P17 spec in `docs/build-plan-execution.md`, following the user's subsequent authorization to continue beyond P12. The additive `qrwty-studio` fixture/acceptance pack keeps QR-01–QR-09 and adds owner-scoped Studio preview, idempotent save, bounded history and immutable PNG/SVG export (QR-10–QR-14). Internal artwork rows retain canonical URL, normalized settings, renderer version and both hashes. The browser receives typed JSON artifact envelopes and downloads verified server bytes. Existing legacy PNG/redirect/activity features are unchanged.

Extracted `@jeeves/product-ui@0.2.0` configuration-editor chrome: typed presets, guarded reset/replacement, visible draft/saving/saved status and sticky mouse-accessible save actions. A non-QR inventory consumer checks the interaction. The skip link now focuses content without changing hash routes. qrwty adopts it for responsive Studio controls, preview, history and session-local draft recovery. Desktop/phone evidence and scope are in `docs/evidence/p17/`.

Added `generate-qrwty-studio.ts` for reviewed additive generation, preserving all previous runtime artifacts and explicitly adopting REST 0.2.0. Added `verify-qrwty-upgrade.ts` and `pnpm work run qrwty-upgrade <old> <next>` to prove migration against a disposable database containing old users/session/QRs/scans. The composed acceptance exposed a real verifier defect: a prior restart can republish ephemeral ports. `verifyBehavior` now resolves current service endpoints before every suite; later artwork acceptance passes after the old restart suite. The acceptance catalog test now includes the additive pack. The existing fixed API helper received Node-compatible type corrections, without weakening behavior.

Validation:

- `pnpm work run check`: 567 tests / 77 files passed; all workspace/script type checks; Biome 459 files, zero errors, existing 166 warnings and 63 infos. Final evidence: `.jeeves-work/runs/2026-10-31T04-57-57-579Z-check-5c53e2c3.*`. First gate correctly failed the old one-pack expectation, which was updated and rerun.
- Disposable consumer type checks, 29 service tests, 13 Chromium workflow tests and Vite production build passed. Browser evidence covers real renderer bytes, save failure/retry with stable request identity, preset/reset confirmation, invalid contrast, responsive overflow, axe and skip-link routing. Logs `/tmp/qrwty-p17-{typecheck,tests,build}.log`.
- Composed product verifier passed four web template checks, strict QR-09 and all ten protected behavior suites, including QR-10–QR-14 and actual API/database restart. Evidence `.jeeves-work/runs/2026-10-31T04-54-54-411Z-qrwty-product-c344dd28.*`. Its fingerprint reports changes during execution: evidence/artifact documentation and the new upgrade-runner profile were added while the disposable copy ran; tested application and verifier implementation remained unchanged. The earlier failure log is retained and traced to stale post-restart endpoints.
- Final frozen-lockfile API image passed the old-to-new upgrade proof in 39.1 seconds: `.jeeves-work/runs/2026-10-31T04-56-31-467Z-qrwty-upgrade-571b3a6c.*`. Both fixture inputs and all old artifacts are intact; disposable containers/volumes/images were removed.
- Both diffs and generated ownership were reviewed; `git diff --check` passed. All 37 generated-owned files and adopted implementation/artifacts match the tested checkout. PNG/SVG exact-byte checks, cross-owner denial, Origin/CSRF denial, normalized retry/conflict, history limits and persistence passed. This is focused evidence, not exhaustive scan/load/reliability certification.

Local adoption completed in qrwty commit `f499053` (`P17: add saved QR Studio designs and immutable exports`). A private database dump at `~/.local/state/jeeves/backups/qrwty/20261031T045723Z-p17/` was verified with container `pg_restore --list`. Only API/frontend rebuilt; the original database container remains. All existing user/session/QR/scan row hashes and counts are identical (13/10/9/8); new artwork table is empty. A strict anonymous live Chromium check passed without creating live records. Web remains 127.0.0.1:5173; API is now 127.0.0.1:33459. The older 5174 stack was not changed. Existing vendor bytes, migration 0001, `.env` and untracked `business-analysis/` hashes are preserved.

The live Jeeves operations API applied only the attachment model and appended web notes at revision 3, preserving canvas layout and the unrelated unfinished `service` element. That element still produces NEEDS_TEMPLATE. Generation deliberately uses the reviewed executable three-element Studio snapshot; it does not pretend the unfinished four-element draft is executable. qrwty's project-owned artifact READMEs record exact renderer/UI hashes and version retention requirements. Previous uncommitted handoff/review/planning work remains uncommitted and preserved.

Remaining limits: draft recovery is in-memory within the signed-in workspace; future renderer changes must retain old artifacts and dependency closure; canonical-origin migration is not implemented. No cloud deployment, paid Jeeves agent run or exhaustive testing campaign. Next bounded package: owner-wide analytics with reusable UTC range/aggregation and presentation contracts, then deterministic product recipes, intentional C4/configuration views and selected enterprise components. The final original-PLAN and Excalidraw/automation-pitch UI review remains required; continue sequentially.

## P18 — bounded owner analytics (2026-10-31)

Completed the P18 scope in `docs/build-plan-execution.md`. The additive `qrwty-analytics` design and acceptance pack retain QR-01–QR-14 and add owner-wide scan aggregation (QR-15) plus the mouse-driven Analytics journey (QR-16). No resources or migrations changed. The workspace provides 7/30/90-day presets, explicit custom apply, visible result dates, loading/error/retry, zero-filled chart/table, top-ten links and Studio navigation. Stale requests cannot relabel or replace newer results. Counts are explicitly recorded redirects, not unique visitors or confirmed destination loads.

Extracted experimental `@jeeves/analytics@0.1.0`: browser-safe UTC calendar/range/count helpers and server-only owned-parent/internal-event aggregation using reviewed descriptors, parameterized owner/date values, a read-only repeatable-read transaction, five-second per-statement timeout, maximum 90 inclusive days, top-ten deterministic count/UUID ordering and safe integer checks. The non-QR inventory interface is exercised offline; qrwty is the real HTTP/Postgres consumer. This implements the authorization/query/presentation separation studied in Umami without copying upstream source. Product-ui 0.3.0 adds generic metrics and a count chart with SVG accessible naming and a complete mouse-accessible table. HTML date/peak labels remain readable at phone width. Artifact provenance is in the consumer READMEs; analytics SHA-256 `737e507b4791283936be5f518512aae97f6ae5fbaea957e0ac088ebdc0bb4048`, UI SHA-256 `389791a7a18bf33bbd66fc0b62e8c52c9abedf22acd7ebd86c53f823d696a615`.

The reviewed adoption helper is now `generate-qrwty.ts <checkout> studio|analytics`; the P17 script remains a compatible alias. It validates the model, regenerates through ownership checks, preserves every previous runtime artifact and explicitly adopts the required REST pin. This is controlled consumer adoption, not automatic product recipes. Updated the acceptance catalog expectation, workflow documentation, architecture-reference follow-through and README status.

Validation:

- Required `pnpm work run check`: 572 tests / 79 files, all types, zero lint errors (473 files; existing 166 warnings and 63 infos), 32.1 seconds. Evidence `.jeeves-work/runs/2026-10-31T05-12-26-668Z-check-76445618.*`. A first lint attempt flagged only the new fixture JSON formatting; formatting was corrected before the successful gate.
- Four focused analytics tests and one non-QR chart/metric test passed; qrwty's 29 existing service tests passed. All 15 strict Chromium workflows passed in 10.93 seconds, including scoped 503/retry, stale range response, explicit custom apply, invalid range disabling, complete daily table, desktop/phone axe and overflow. The first browser run caught invalid definition-list markup in the shared Metrics component; it was fixed and all affected workflows passed. Types and Vite production build passed (135 modules, 328.96 kB JS / 100.30 kB gzip). Logs `/tmp/qrwty-p18-{tests,browser,typecheck,build}.log`; inspected screenshots in `docs/evidence/p18/`.
- Composed disposable verification passed four web checks, strict QR-09 and all twelve protected suites through QR-16, including actual PG UTC boundaries, owner isolation, zero-fill, top-ten ties and existing Studio persistence/restarts. Evidence `.jeeves-work/runs/2026-10-31T05-10-17-326Z-qrwty-product-e266c739.*`, 95.5 seconds. Source-change flag reflects evidence/artifact/reference documentation added while the disposable copy ran; application/component implementation stayed unchanged. Both disposable databases/containers were removed.
- Reviewed both diffs; whitespace checks passed. All 39 generated-owned files and 15 adopted project-owned files match the tested checkout. All prior artifact, migration, environment and unrelated-file hashes remain unchanged.

Local qrwty adoption is committed as `9bc5467` (`P18: add bounded owner analytics and scan dashboard`). API/frontend rebuilt; the database container and all user/session/QR/scan/artwork row hashes and counts stayed identical (13/10/9/8/0). No live synthetic records or schema migration. Strict anonymous live Chromium verification passed. Web remains 127.0.0.1:5173, API now 127.0.0.1:33468; older 5174 stack untouched. The live editor's targeted model/notes update is revision 4, retaining the unfinished Service and original layout. Generation still uses the reviewed executable three-element snapshot. Untracked qrwty `business-analysis/` and earlier uncommitted Jeeves review/planning/handoff work are preserved.

Limits: range/result/time bounds are not admission control or a capacity certification; queries can inspect many events. No rollups, retention changes, visitor tracking, geographic enrichment, CSV exports or exhaustive load/security campaign. No paid model or public deployment. Next bounded package: deterministic product recipes to assemble the proven qrwty product without implementation-model calls, followed by intentional C4/configuration views and selected enterprise components. Final original-PLAN and Excalidraw/automation-pitch review remains required; continue sequentially.

---

## P19 — deterministic QR Studio product recipe (2026-10-31)

**Built:** `qr-studio@0.1.0` supplies the complete QR library, immutable artwork Studio and bounded owner analytics from a separately created diagram. `design.recipe` is optional (old document serialization remains unchanged) and `setRecipe` is undoable. The server catalog and mouse “New from recipe” flow create a new positioned project with finite name/tagline/7–30–90-day configuration and a stable free loopback web port. Core compatibility appears in Findings; Generate automatically includes protected recipe acceptance. Existing live qrwty was not regenerated or adopted.

The snapshot records qrwty `9bc54675f607ce05c22f86ec33c704ce1d322f1d` and Jeeves `9e03c55c32bfb382a6c7abb034cae7905930f682` provenance, 29 source files, ten packaged artifacts and ten fixed product suites/support. Its final manifest SHA-256 is `56c7a84bf3699b8a725b7a6dfe42b3cbc14bbebe157dc97245b7299daf51f317`. The generator protects implementation/configuration/artifact/test hashes (70 generated paths), validates required template/resource/operation/connection/dependency contracts before writes, and refuses adoption, recipe detachment/version changes and incompatible public-origin edits. A private ignored mode-0600 `.env` is created only for fresh outputs; existing environment is preserved. `ProjectExtras.tsx` is an explicit project-owned UI seam; independent additions remain implementation tasks. Recipe-provided operations/frontends seed no tasks and select no implementation model. Runs distinguishes supplied behavior from verification evidence. Baseline now runs the provided frontend/product suites even before any implementation run.

**Verification:**

- `pnpm work run check` passed: **580 tests / 80 files**, all workspace/script types, Biome 520 files (189 warnings, 65 informational diagnostics, zero errors). Exact log/result: `.jeeves-work/runs/2026-10-31T05-45-52-861Z-check-dff7149f.*`.
- Focused tests cover old documents/operation schema, API creation/undo, deterministic generation/regen, protected source and binary refusal, dependency/core compatibility, environment/printed-origin preservation, custom UI preservation, missing ownership registration and zero provider calls. Gate failures during development exposed the new operation count and a registry-only empty spec suite; both corrected without weakening behavior checks.
- `pnpm work run qr-studio-recipe` passed from an empty directory, frozen install/build and normal baseline: **30 passing checks, all QR-01–QR-16**, 116.5s. `.jeeves-work/runs/2026-10-31T05-38-52-422Z-qr-studio-recipe-c9c56f6e.*`. Two generic REST example checks skip by existing semantics; independent standard behavior plus all protected product suites ran. No live qrwty source or model was used. Temporary databases, volumes and containers were removed. The run fingerprint changed for docs; final snapshot differs only by relocation of a Biome explanation comment, detailed in `docs/evidence/p19/README.md`. All artifact/executable bytes are the tested ones.
- `pnpm work run browser apps/web/e2e/recipes.spec.ts` passed its strict mouse journey (final log `2026-10-31T05-45-10-050Z-browser-7395a3f4.*`). It configures a new diagram, verifies the original project is unchanged, switches back, and deletes its fixtures. A repeated-run duplicate-name ambiguity was fixed with a unique test project name.
- Fresh configured-product desktop/phone inspection passed strict diagnostics with the exact signed-out session 401 scoped; `/tmp/p19-visual2.log`. Inspected screenshots in `docs/evidence/p19/`. The new `pnpm work run qr-studio-recipe` profile records complete logs/fingerprints and cleans up on cancellation; failed cleanup is reported and retains its temporary directory.
- Diff/ownership/provenance review and `git diff --check` passed. Live qrwty remains at P18, including its private data/URLs, generated ownership and unrelated `business-analysis/`. Earlier uncommitted review/handoff/improvement work remains unstaged.

**Limits / next:** experimental, new projects only; no recipe-upgrade/data migration or production capacity certification. Existing operations cannot be redefined with notes; independent custom behavior needs its own contract/implementation/acceptance. Archived source has narrow documented effect-dependency exceptions preserving explicit retry/reset/settings triggers. C4 context/container/component views and structured product configuration are the next bounded package (P20), using real executable bindings and capability evidence; then the smallest useful enterprise event-delivery component and the original PLAN/Excalidraw/automation-pitch visual review. Continue the user's authorized overnight work; do not run paid implementation agents.


## P20 — intentional C4 views and structured configuration (2026-10-31)

Completed the P20 spec in `docs/build-plan-execution.md`. The original PLAN now explicitly describes C4 context/container/component scopes, deterministic product recipes, optional implementation orchestration and named capability evidence instead of an assumed generated percentage. Context intent is optional strict semantic data with one undoable `setArchitecture` operation, duplicate/reference checks and explicit container bindings. Removing a bound element preserves its relationship as visible unbound intent. Old documents retain their serialization. New QR Studio projects receive the known owner/scanner/destination context; the released recipe snapshot and live qrwty draft were not changed.

Pure projections bind container relationships to real executable connections. Component scopes expose actual HTTP/resource/session/client responsibilities and declared extensions; data contracts stay separate. Unknown template versions are labeled as intent, and connected containers retain consistent provision across levels. Server-validated recipe coverage distinguishes provided implementation, added project work and architecture intent. New frontend notes remain visible as additional implementation work. Context relationships never create network wiring; the QR browser follows the redirect destination, rather than the API fetching it.

The mouse-accessible Architecture workspace has level/container navigation, stable card and inspector structure, wrapped relationship labels, scope boundaries, explicit object focus, zoom/fit, provenance and acceptance references, Edit on board and context/product Save/Cancel. Product title/tagline/7–30–90-day defaults save as one undoable batch; configuration does not generate, deploy or alter running products. Stale drafts refuse overwrite. All view navigation preserves board positions/camera and semantic state. A narrower two-column context layout contains every card. `README.md` and `docs/evidence/p20/` describe behavior and limits.

Verification:

- `pnpm work run check` passed: **589 tests / 82 files**, all workspace/script type checks, Biome 529 files with **zero errors**, 204 warnings and 65 informational diagnostics. Final `.jeeves-work/runs/2026-10-31T06-16-15-557Z-check-1c718fe7.*`, 34.3 seconds. The source-change flag reflects only copying the already-inspected screenshots and writing their evidence README while the gate ran; tracked implementation diff hash is identical before/after. No code changed during that run. An earlier gate also passed before the responsive refinement; initial lint rejected an untyped optional provision variable, now explicitly typed.
- Focused architecture/schema/operations/recipe/API checks cover old-document compatibility, atomic invalid-reference rejection, removal/unbinding, undo, non-QR inventory projection, actual connection references, unknown versions, consistent provision, added frontend work and unchanged generated runtime/artifact bytes for architecture-only edits. The earlier focused run passed 85 tests; final gate includes the added API case.
- `pnpm work run browser apps/web/e2e/architecture.spec.ts`: **two strict Chromium journeys passed**, final `.jeeves-work/runs/2026-10-31T06-15-39-948Z-browser-920c9c55.*`, 8.3 seconds. Context edits, drill-down, object focus, product cancel/save/undo, reload, exact unchanged board layout/camera, unbound warning, narrow containment/overflow and axe passed. No browser-error suppression was added. Early failures exposed unstable modal naming after reopen and a duplicate banner landmark; the compound accessible dialog fixes both. Screenshot review caught cropped narrow cards, now fixed and asserted.
- Read-only actual-UI comparison with Excalidraw and the local automation-pitch demo plus its full VISUAL_IMPROVEMENTS history informed controls, selection, diagram scale and clipping fixes. Reference and resulting screenshots were inspected and saved in `docs/evidence/p20/`. The temporary automation-pitch server was stopped and its only newly created untracked lockfile removed; that repository is clean.
- Diff review and `git diff --check` passed. No generated runtime, archived recipe bytes, live qrwty data/URLs/ownership or public deployment changed. The full disposable QR product suite was therefore not repeated. No paid implementation agent. Earlier 52 uncommitted handoff lines, improvements/review/planning work and qrwty `business-analysis/` remain preserved outside this commit.

Limits: deterministic derived positions, not persistent custom per-view layouts; no arbitrary internal call-graph discovery, behavioral/screen view or deployment topology. Large component scopes support pan/zoom/object focus; this is not mobile-editor certification. Provision labels are implementation provenance, not current production evidence or a bug-free claim. Additional reliability mechanisms remain absent until implemented and checked in their own versioned component.

Next bounded package: **P21, durable event delivery with explicit retry/lease defaults and a non-QR consumer**, using the inspected open-source architectural patterns without copying upstream runtime code. Specify the component, storage contract, extension seam, focused failure checks and local proving path first. Then perform the required broader original-PLAN / Excalidraw / automation-pitch product and architecture review. Continue the authorized overnight work sequentially.


## P21 — durable event delivery component (2026-10-31)

Completed the bounded P21 spec in `docs/build-plan-execution.md`. Experimental `@jeeves/durable-events@0.1.0` owns transactional tenant-scoped enqueue, normalized event deduplication, persistent policy snapshots, pending/running/succeeded/exhausted states, concurrent Postgres claims, expiring token-fenced leases and finite retry/backoff. Standard and Responsive presets define explicit attempt/delay/lease/cooperative-deadline/poll values. A worker keeps one in-flight handler even if it ignores cancellation. Registered type/version validators and application-owned handlers remain narrow extension seams. A delivery key does not make an arbitrary producer business command idempotent.

The component's database-effect helper checks the live lease and commits a durable receipt with the business effect. Redelivery skips a completed effect; failure rolls back both. Status is queue/tenant-scoped, bounded and excludes payload/token/raw exceptions. `effectCommitted` makes an already committed effect visible even when later work fails. External effects remain at-least-once attempts requiring destination idempotency; no exactly-once network claim, automatic fan-out/replay/retention or capacity certification. SQL migration 0001 is immutable and consumer-owned through a protected migration runner. Callbacks cannot issue transaction control/multiple SQL statements or escape a closed query scope.

The architecture follows inspected Medusa delivery/handler separation and Zulip's transaction-aware publication lesson, with original implementation and no copied upstream runtime/dependency. The event is stored inside the business transaction, closing the gap left by publication only after commit. The pinned Medusa/Zulip caches were verified offline against their recorded hashes. Official PostgreSQL 17 locking/time documentation informed the query contract. README/reference/evidence docs describe defaults, obligations and limits. `pnpm work run durable-events` provides a named focused Docker profile with complete logs/fingerprints and fixture cleanup.

Verification:

- `pnpm work run check`: **594 tests / 83 files**, all workspace/script types and zero lint errors, 34.5 seconds. Exact unchanged-source evidence `.jeeves-work/runs/2026-10-31T06-37-50-069Z-check-ce7cb6d5.*`. Five new offline tests exercise strict canonical JSON, policy bounds/determinism, cooperative deadlines, no overlapping handler, permanent/invalid failures, cancellation and lost ownership.
- `pnpm work run durable-events`: **four real-Postgres conformance scenarios passed**, 9.7 seconds, `.jeeves-work/runs/2026-10-31T06-34-36-064Z-durable-events-47815524.*`. A disposable non-QR inventory consumer proves business/event rollback, normalized/conflicting identities and tenant isolation, two concurrent clients claiming distinct events, stale token refusal, due-time retry/exhaustion and expired final-attempt visibility. An actual database restart between committed effect and missing acknowledgement retains one effect; a failed effect/receipt rolls back and later retry applies once. Test SQL advances only the disposable fixture's due/lease timestamps to avoid needless sleeps. This is not a load or chaos campaign. Containers/volume were removed and checked absent.
- `pnpm --filter @jeeves/durable-events pack --pack-destination /tmp/jeeves-p21-artifact` built the compiled runtime. A fresh native Node consumer imported packaged root/policy exports, constructed the worker and completed an empty transactional claim without workspace/TS resolution; `/tmp/p21-pack.log` and `/tmp/p21-package-smoke.log`. Its temporary directory was removed.
- Frozen archive `artifacts/durable-events/0.1.0/jeeves-durable-events-0.1.0.tgz` SHA-256 **`b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd`**. Manifest records source hashes and no runtime dependencies/upstream code. All recorded hashes were verified. Do not modify these bytes or migration under version 0.1.0.
- Diff/ownership review and `git diff --check` passed. Review tightened sparse-array normalization and callback transaction ownership before final proof/pack. The lockfile only adds the new dev dependencies and the previously missing empty analytics workspace entry. No UI changed, so browser tests were not repeated. Live qrwty, its generated ownership/data/URLs, released QR recipe and unrelated `business-analysis/` remain untouched. Earlier 52 uncommitted handoff lines and review/planning/improvements work stay outside the commit.

Limits: cooperative handler cancellation; no heartbeat renewal, forced termination, global ordering/fairness, fleet capacity, admission control, external webhook transport or managed delivery UI. Two concurrent clients are focused claim-isolation evidence, not a multi-region/failover proof. An exhausted event can have committed effects. The component is not yet an executable diagram attachment; no decorative architecture capability was added.

Next bounded package: **P22, generated durable-event attachment and visual policy configuration**, wiring this frozen component to real service/database dependencies, protected migrations/configuration and an explicit handler seam. Prove generation/ownership and the non-QR composed fixture; retain all existing QR recipe/runtime artifacts and live data. Then complete the original-PLAN / Excalidraw / automation-pitch product/architecture review and continue the authorized overnight work in bounded packages.


## P22 — executable durable-event attachment and visual contracts (2026-10-31)

Implemented the P22 specification in `docs/build-plan-execution.md`, sequentially, without paid model runs or live qrwty regeneration.

- Added `durable-events@0.1.0` and `http-service@0.2.0`; retained the original HTTP 0.1.0 manifest/runtime. Events bind to the service's actual Postgres connection. The worker is explicitly in-process, not another C4 container. New subtype choices show versions so retained/new variants are distinguishable.
- Added strict finite event/type/version/payload/acceptance configuration, a mouse editor with visible Standard/Responsive defaults, validation, Save/Cancel and single-step undo, and C4 delivery/handler/storage projections. Draft identities survive editable names/removals. Fixed the Architecture “Edit on board” path to focus the real element after remounting. Generic attachment notes remain in the generated element brief; per-event notes drive bounded handler tasks.
- Generated pure contracts/typed producer, a separate checksum/advisory-lock event migration journal, lifecycle/readiness wiring and per-event project-owned handlers. Empty handlers fail explicitly. Known transient PostgreSQL/driver/network/Docker DNS failures keep the worker unready and retry; unexpected failures require restart. Cancellation remains cooperative. Applied migration mismatches refuse startup; normal resource/Drizzle numbering is unchanged.
- Added reusable frozen-runtime copying/hash validation and pinned production-dependency guards. P21 archive remains `b0658fce9fbb692e317c54ded4c9b4fff3d4eb3c66b5d4b550947f67f60776fd`. Regeneration refuses event contract removal/redefinition, attachment/store moves, edited protected SQL/wiring/archive or replaced component dependency; new versions append while prior handlers/SQL persist. No released archive or QR recipe source changed.
- Fixed acceptance recognizes explicit `event:<attachment>:<event>` identities in the existing registration field; these are not HTTP routes. Narrow handler tasks exist even with blank notes, require fixed acceptance and bypass the planner. Server planning, per-task checks, deferred baseline reporting and terminal gates now include event work without weakening REST coverage. Producers still own authentication/authorization and business-command idempotency; domain effects remain the explicit seam.
- Added `pnpm work run generated-events`: a disposable generated Orders/Postgres consumer and reviewed producer/handler fixture, separate from P21's direct component conformance. It passed 11 checks including protected ORDER-01, database interruption recovery, graceful shutdown, equivalent enqueue identity, one inventory effect, service/database restart persistence, resumed delivery and regeneration. Final evidence `2026-10-31T07-07-39-216Z-generated-events-32241449.*` (67.0s). Fixture containers/volumes/images/temp output were removed. Early failures found real worker reconnect cases and a fixture-only Compose project-directory omission; both were corrected, without suppressing diagnostics.
- Final `pnpm work run check` passed: 599 tests/84 files; all workspace/script types; Biome 558 files, 227 warnings/65 infos, no errors. `.jeeves-work/runs/2026-10-31T07-12-51-547Z-check-832ddd62.*` (34.0s, unchanged source). Final strict browser regression: 4 passing architecture/event journeys, `2026-10-31T07-10-32-554Z-browser-74126cd7.*` (9.8s), including axe, cancel/save/undo/redo/reload, new-service attachment and narrow containment. A direct previous-generator comparison confirms byte-identical old HTTP output for five fixtures (`/tmp/p22-http-compat.log`). See `docs/evidence/p22/` and `templates/durable-events/README.md`.

Reviewed the scoped diff and preserved the pre-existing 52-line handoff delta, improvements note, untracked build-plan-next/reviews and qrwty business-analysis directory. Live qrwty, QR URLs/data, published component/recipe ownership and automation-pitch remain unchanged.

Limits: experimental focused evidence, not exhaustive certification; no arbitrary event-schema migration, transport provider, replay/retention UI, standalone worker fleet, cloud scaling or automatic domain-effect/producer composition. A handler ignoring cancellation can block its worker and be redelivered after its lease. Next bounded work is the required original-PLAN / Excalidraw / automation-pitch product/architecture review, followed by a specified highest-impact authoring gap (currently structured resource contracts rather than raw JSON). Continue the authorized overnight work; do not treat this package as the overall finish.

## P23 — structured resource authoring and interim product/architecture review (2026-10-31)

Completed the authorized next bounded package in `docs/build-plan-execution.md`. The original-plan/C4 and Excalidraw/automation-pitch comparison is recorded in `docs/architecture-product-review-2026-10-31.md`, using the previously inspected application/source evidence and revisiting the relevant visual-improvement lessons. It identifies raw resource JSON as avoidable model dependence and retains honest gaps around generic product screens, recipe evolution and operational policy.

The REST inspector now offers a focused resource list/detail editor for owner/internal records, bounded text/URL/integer/enum/generated timestamp fields, required relationships, CRUD choices and the actual Postgres connection. A readable endpoint preview and visible draft footer explain the result. Save sets the existing session `/api` mode in one semantic operation; cancel, undo/redo, reload and stale revisions preserve state. Names change independently of stable IDs; removed draft IDs are reserved. Existing domain extensions, GET/POST contracts, dependencies and acceptance references retain their raw semantic JSON, including omitted defaults. Advanced API configuration remains an explicit disclosure.

Recipe boundaries are supplied by the hash-verified server catalog: provided resource IDs and their store are protected in the ordinary editor, while separate supported resources can be added. No recipe snapshot, released runtime, migration rule, generated-file ownership or live qrwty data/output changed. The shared named configuration dialog preserves C4/event behavior and supports a fixed footer; disabled recipe values remain readable.

Validation and evidence:

- Strict resource profile `2026-10-31T07-31-21-401Z-browser-750f266c`: 3 passing journeys, 10.2s. Mouse field/relationship authoring, validation, save/cancel/undo/reload/rename, narrow layout and axe, exact extension preservation, recipe protection, scoped concurrent-editor 409 refusal, and disposable non-QR Inventory generation with matching API/resource model and protected contract hash. Output cleaned; no model calls.
- Existing C4/event dialogs: 4 passed in the first P23 browser run; existing inspector: 4 passed in the second. Those overall runs exposed the new resource Save-button contrast, corrected before final evidence. Another new-test failure corrected an incorrect lock-format expectation; the actual lock is a path/hash map. No broad browser-error suppression was added.
- Required `pnpm work run check`: `2026-10-31T07-34-28-051Z-check-7a11f7c4`, 602 tests in 85 files, all type checks and lint, 32.6s, no source changes during the run. Biome: 252 nonblocking warnings, 65 infos. Earlier gate failures were test-fixture URL/default construction errors; the focused corrected fixture also passed separately.
- Inspected desktop/narrow/recipe screenshots and recorded limitations in `docs/evidence/p23/README.md`. Diff and whitespace reviewed. Frozen artifact/recipe trees and live qrwty remain untouched. Preserved the pre-existing 52 handoff lines, improvements change and untracked review/build-plan-next work outside this commit.

Next bounded direction: a reusable finite resource-workspace UI, then generated/visual composition, to remove repeated frontend CRUD implementation. Define its supported session, field, paging and relationship responsibilities explicitly; do not imply arbitrary enterprise workflows, cloud guarantees or exhaustive certification. Continue the authorized overnight work sequentially. The overall review is interim through P22/P23; revisit it after subsequent packages.

## P24 — reusable compiled owner-resource workspace (2026-10-31)

Implemented the bounded component package in `docs/build-plan-execution.md`, sequentially, with no paid model run, live consumer regeneration or deployment. Experimental `@jeeves/resource-workspace@0.1.0` supplies a strict finite collection/view contract, same-origin session/CSRF transport, account access, owner-record pages/details, create/update forms, required relationship choices and Midnight/Paper presets. It reuses the exact released product-ui 0.3.0 archive. Payload's reviewed collection/authorization separation informed the boundary; no upstream runtime code was copied.

The API remains the authorization authority. Tokens stay in memory and cookies; mutations have no implicit retries. Finite body/time limits, safe errors, explicit server-unavailable Retry, session-epoch refusal and account-data unmount protect ordinary interactions. Current API PATCH semantics require resending all required fields/relations; untouched optional values are omitted and unchanged forms perform no write. Generated timestamps/identity are display-only. Cursor pages and related-record selectors use actual bounded API reads; no total, delete, global search, admin or business operation is invented.

Published artifact SHA-256: `dbe8b4579b75dfac42cb95a459ec4581436e06dfeb95c7fbd6fa09ec5b48488f`. Source/archive hashes verified; this version is frozen after this commit. Product-ui remains `389791a7a18bf33bbd66fc0b62e8c52c9abedf22acd7ebd86c53f823d696a615`; its canonical artifact location promotes the existing recipe bytes without repacking. No released QR recipe/runtime changed.

Validation and evidence:

- `pnpm work run resource-workspace`: `2026-10-31T08-16-47-828Z-resource-workspace-7bcb6336`, passed in 58.8s with unchanged source. One composed browser journey covers six scenario groups against a fresh compiled Inventory frontend, generated API and isolated Postgres: accounts, owner isolation, forms, relationship paging, record paging, session lifecycle/responsive accessibility. It verifies strict diagnostics, scoped 500/401 handling, axe, generation integrity, preserved project integration and archive bytes. All fixture output, containers, images and volumes were cleaned. No implementation model was used.
- Required `pnpm work run check`: `2026-10-31T08-20-53-434Z-check-34089e35`, passed in 35.4s, unchanged source: 608 tests/87 files, all type checks and lint; 262 nonblocking warnings and 66 infos. Six focused new unit cases cover contract/input, transport/session, obsolete identity and timeout/cancellation boundaries.
- Inspected desktop/narrow/form screenshots in `docs/evidence/p24/`. Early composed runs exposed required PATCH values, missing accessible headings and response-body cancellation creating false browser aborts; fixed by exact protocol handling and bounded body draining/completion before React cleanup. Fixture edge/vendor paths and axe's explicit browser context were corrected. No suppression was broadened. Reviewed scoped diff, whitespace, frozen source/archive hashes and cleanup.

Preserved the earlier 52 uncommitted handoff lines, improvements note, untracked build-plan-next/reviews, live qrwty data/URLs/ownership and its unrelated business-analysis directory. The reviewed frontend integration in this package is deliberately project source: it is not yet automatic diagram composition. Limits include no optimistic concurrency token, enterprise identity/admin system, arbitrary filtering/workflow or exhaustive certification.

Next bounded package: **P25, generated resource-workspace attachment and visual configuration**, deriving UI contracts from actual session/resource wiring, reusing these immutable archives, protecting generated composition and retaining a narrow additive project seam. Prove fresh non-QR generation with no frontend implementation model; continue the authorized overnight work sequentially.

## P25 — generated resource workspace and visual composition (2026-10-31)

Completed the bounded package in `docs/build-plan-execution.md`, sequentially, without live qrwty regeneration, paid implementation agents or deployment. `resource-workspace@0.1.0` and `web-app@0.2.0` now turn the P24 component into an executable diagram capability. Original web 0.1.0 output remains available and unchanged.

- The workspace selects an actual REST-client calls edge into a session resource API. Stable resource/field IDs define labels, primary/table display, page size and Midnight/Paper preset; field types, validation, relationships and operations derive from the backend contract. Owner list/read and accessible parent closure are required. Invalid/internal/missing-parent/cyclic bindings cannot generate. Incomplete configuration is a readiness finding so users can attach and finish wiring it.
- Protected composition includes app/root/styles/derived descriptor, ordinary proxy/client wiring and the exact frozen workspace/product-ui archives. Added multi-runtime module support with conflict refusal. Lock history retains workspace/API binding; removal/rebinding needs reviewed ownership migration. Existing project roots are not adopted implicitly. Frozen component pins and generated integrity are checked before planning. No released source/archive or QR recipe bytes changed.
- Project-owned `src/project/ProjectExtras.tsx` remains an additive seam. Notes seed bounded tasks only for that directory, supplemental tests and permitted package changes; no notes means no implementation task or planner call. Runs explicitly reports supplied workspace coverage, and C4 shows the actual API dependency, generated responsibilities and additional notes as project work. Version-specific web guidance avoids conflicting ownership instructions.
- The mouse editor supports actual API/collection selection, labels, stable display fields, finite presets/page sizes, effective operations, validation, Save/Cancel, undo/reload, stale draft refusal and a reachable footer. No custom domain-command UI, internal admin access or new infrastructure was implied.

Validation/evidence:

- `pnpm work run generated-workspace`: `2026-10-31T08-40-42-805Z-generated-workspace-51d3d9ea`, **72.1s**, unchanged source. Fresh Inventory generation/build, **19 passing template checks**, two legacy stateful REST checks explicitly inapplicable, zero implementation tasks/model calls. One reused composed browser journey covers accounts, owner isolation, forms, relationship paging, record paging and session/responsive accessibility. Actual regeneration/rebuild changes the preset to Paper and retains records/session/custom extras. Exact archives and protected generation integrity survive regeneration. All disposable output/containers/volumes/images were cleaned.
- Strict editor profile `2026-10-31T08-43-16-650Z-browser-a26165f8`: **2 passed**, 8.3s, unchanged source, including real C4 binding, initial attachment, API selection, missing-parent validation, save/cancel/undo/reload, concurrent 409 draft preservation, narrow containment and axe. The initial UI profile also passed both existing delivery journeys. Product/editor screenshots inspected in `docs/evidence/p25/`.
- Required `pnpm work run check`: `2026-10-31T08-46-24-366Z-check-6f8885b3`, **613 tests/88 files**, all types and lint, 34.0s, unchanged source. Biome: 303 nonblocking warnings, 70 infos. Focused tests cover binding/old-version refusal, safe display rename/regeneration, frozen dependency/archive/root protection, existing-root adoption refusal, narrow task ownership and server-side zero-model planning/integrity refusal.
- Earlier proof failures corrected initial config being structural instead of readiness, a case-sensitive fixture label, existing explicit CheckSkipped handling, and a same-hash navigation that did not reload the rebuilt bundle. The first gate found a qrwty-specific Runs harness environment; the isolated Inventory case and final gate pass after supplying correct fixture values. Generation failures now report their cause immediately. No validation, timeout or browser diagnostics were weakened.

Reviewed the diff/whitespace and confirmed unchanged published workspace/product-ui hashes (`dbe8b4579b75dfac42cb95a459ec4581436e06dfeb95c7fbd6fa09ec5b48488f`, `389791a7a18bf33bbd66fc0b62e8c52c9abedf22acd7ebd86c53f823d696a615`). Preserved the pre-existing 52 handoff lines, improvements note, untracked build-plan-next/reviews, live qrwty data/URLs/ownership and unrelated business-analysis directory. P24 conformance helper changes are outside its frozen runtime source manifest.

Limits remain the P24 finite owner-resource protocol: no arbitrary workflow/command screens, tenant administration/SSO, optimistic concurrency, cloud operations or exhaustive certification. **Next bounded package: P26, an accessible architecture starting experience with an editable resource-application starter**, distinct from a frozen product recipe, so users can reach this working composition without recreating fixture wiring. Reassess original-plan/C4/Excalidraw/automation-pitch alignment after that slice and continue the authorized overnight work sequentially.

## P26 — editable architecture starters and a clear first project (2026-10-31)

- Continued the user's authorized overnight product/component work sequentially after P25. Specified P26 in `docs/build-plan-execution.md`, inspected the existing diff and preserved the pre-existing 52 handoff lines, improvements edit, untracked build-plan-next/reviews and qrwty business analysis. No paid agent/provider runs, cloud deployment, live qrwty regeneration or live editor mutation.
- Added hash-verified `resource-workspace@0.1.0` architecture starter: three actual containers, owner-scoped Warehouse/Stock Item resources, generated account/resource screens and deliberate member/system context. Manifest SHA-256 `31fc24a5bca956a718681689e7495a8672f7e8047049355250d1e530348e9007`, with separately verified design/layout sources. `startedFrom` is editable-copy provenance; it does not freeze resources, claim verification or provide domain behavior. Snapshot versions are immutable after release; ordinary template/data/ownership rules remain authoritative.
- Added bounded catalog/factory/server creation with validated name, finite workspace preset/page size/tagline and stable loopback frontend port. Project/design/layout creation is atomic and separate from the prior project. Unknown versions/configuration are refused; no client source/path upload. Resource contracts remain editable and preserve provenance.
- Fresh supported output receives ignored private `0600` local `.env`, derived from actual workspace/API/Postgres bindings. Random credentials stay out of design/catalog/generated-owned files/logs. Existing secrets/origins remain unchanged; missing previous environment, conflicting/ambiguous origins, ambient credentials, unknown provenance and implicit nonempty adoption stop before writes. This is local setup, not secret rotation/deployment infrastructure. Additional unsupported capabilities can require explicit environment configuration.
- Added mouse project chooser with editable Resource workspace / protected QR Studio / Blank canvas, bounded configuration, catalog error/retry, separate-project explanation and fixed actions. Empty canvas has a starting action. Starter guide links to real C4/resource/screen/Generate controls, describes origin honestly and can be dismissed. Direct recipe creation remains supported. Screenshot review caught initial guide/toolbar overlap; final placement avoids it. Strict Mode exposed duplicate catalog reads; the request is now shared within the mounted chooser/retry, with normal strict HTTP diagnostics retained.
- Added `pnpm work run resource-starter` by reusing P25's bounded composition verifier. Fresh factory generation consumes its actual private environment in an isolated Compose fixture; no hand-written application root or implementation task/model. It builds both generated visual presets, preserves custom extras/private values and checks frozen archives/generated integrity. Product-ui, resource-workspace runtime and QR recipe bytes are unchanged.
- Updated PLAN's current C4/deterministic/starter intent, corrected stale README claims (qrwty outstanding, JSON-only resources, mandatory model setup), and reviewed current UI/product architecture against the original PLAN and the P20 Excalidraw/automation-pitch observations including `.docs/VISUAL_IMPROVEMENTS.md`. Updated review and P26 screenshots are in `docs/architecture-product-review-2026-10-31.md` and `docs/evidence/p26/`. Read-only automation-pitch checkout remains clean.
- Verification: focused factory/environment/project routes `2026-10-31T09-02-51-636Z-unit-220e2add` — **19 tests / 2 files**, 5.9s. Final strict browser `2026-10-31T09-06-20-526Z-browser-86455c63` — **2 journeys**, 9.1s, including mouse creation/edit/generation, prior-project preservation, narrow/light/dark axe and scoped 503 recovery. Direct QR recipe regression passed in the earlier 3-journey run; that run's catalog-failure case exposed the fixed duplicate read. No broad suppression or increased timeouts used to obtain the final pass.
- Disposable starter `2026-10-31T09-04-21-086Z-resource-starter-17781fda` — **pass, 74.1s**, fresh install/types/build, **19 template checks**, **2 explicitly inapplicable stateless REST checks**, one browser journey with six scenario groups (accounts, owner isolation, resource forms, relationship paging, record paging, session lifecycle/responsive accessibility). Zero implementation tasks/model calls; isolated output/containers/volumes removed.
- Required `pnpm work run check`: `2026-10-31T09-08-43-279Z-check-16593824` — **pass, 36.6s**, lint 608 files / 321 warnings / 70 infos / no errors, all types, **617 unit tests / 89 files**; `sourceChanged:false`. `git diff --check` passes. Frozen artifact paths have no diff. Focused evidence is not bug-free, load/security/chaos or enterprise certification; exhaustive campaigns remain deferred per user direction.
- Next bounded package selected by the updated review: **P27 architecture verification evidence**. Show actual supplied behavior, explicit implementation gaps, generated/check revision and stale evidence with useful Generate/Runs links. Use existing records, preserve verification layers and avoid guessed completeness percentages. Continue the authorized overnight work; later local execution policies and domain command screens need separate packages.

## P27 — revision-aware architecture evidence (2026-10-31)

- Continued the authorized overnight work sequentially after P26, with P27 specified before implementation. Preserved the pre-existing 52 handoff lines, improvements edit and untracked build-plan-next/reviews, plus qrwty business-analysis. No live regeneration, provider/paid agent calls, new deployment or exhaustive test expansion.
- Architecture API now projects the latest project-scoped generation and implementation run: design/output identity, bounded stage/check details, disclosed omissions and aggregate task statuses. It excludes logs, diffs, task descriptions and provider payloads; performs no filesystem/deployment check or model invocation; requires no migration. Newer failures/running/cancelled attempts never inherit a previous pass. Existing recording/execution is unchanged.
- Shared deterministic evidence interpretation keeps revision/output match separate from recorded outcome. Baseline-disabled output is written-only; missing required stages, truncated records and deferred application acceptance cannot produce a passing baseline interpretation. Declared acceptance IDs match application checks only within the actual service scope, with failed/skipped/unrecorded outcomes visible. Truncated selected-reference evidence remains unrecorded rather than borrowing an early pass. Stored evidence is not a claim about current files or a deployed application.
- Added a compact revision/evidence strip and fixed-footer evidence dialog alongside C4. Actual readiness stages, template conformance and application acceptance retain separate meanings; current supplied responsibilities/project work come from the semantic projection. Selected references, recorded output and latest run/task status are inspectable. Refresh is read-only and preserves C4 scope/object/camera; real Generate/Runs actions navigate without starting work. Narrow/light and desktop/dark dialogs pass axe and remain mouse accessible.
- Strict browser regression exposed ResizeObserver errors when a semantic reload temporarily removed the summary strip. Temporary diagnostic instrumentation traced the graph's 37px height change; retaining a stable summary footprint fixed the cause. No native error suppression, third-party patch or timeout relaxation. Removed the temporary trace test. Screenshot review refined the first evidence card to show actual whole-project readiness stages instead of an empty infrastructure-check count.
- Focused offline `2026-10-31T09-18-05-125Z-unit-e661f993` — **19 tests / 2 files**, 5.8s: two new interpretation/reference cases and one latest-record/project-isolation/bounded-projection case, with existing project-route regressions. Initial typecheck found an optional-state narrowing error, corrected before final checks.
- Strict browser `2026-10-31T09-20-31-816Z-browser-19ff0e4e` — **4 journeys**, 9.5s, including the existing two C4 regressions. Final dialog refinement `2026-10-31T09-21-27-428Z-browser-b31801b6` — **2 evidence journeys**, 8.6s. Actual starter generation proves written-only and edited/stale states; a clearly labeled controlled read-only response exercises mixed outcomes, service-scoped acceptance and a newer failure. Fixture outcomes are not real qrwty acceptance. Screenshots and exact limits are in `docs/evidence/p27/`.
- Required gate `2026-10-31T09-22-56-218Z-check-3f9fd5ec` — **pass, 38.5s**: lint **613 files / 328 warnings / 70 infos / no errors**, all types, **620 unit tests / 90 files**, `sourceChanged:false`. An earlier gate stopped on a test-file formatting change; formatting was corrected. `git diff --check` passes. No frozen starter/template/runtime/artifact/recipe diff. Updated README and the original-plan/visual product review through P27.
- Limitations: this is the latest recorded generation plus a separate run summary, not an all-history report or current working-tree/deployment attestation. Large detail lists are bounded with explicit omissions. Domain correctness remains dependent on declared acceptance. Capacity, chaos, security certification, organization policy and cloud infrastructure remain separate future work.
- Next bounded package: **P28 local execution policies** — opt-in versioned CPU/memory, restart and shutdown presets with actual Docker evidence and mouse configuration; preserve existing output by default. Horizontal pools/load balancing require a later distinct contract. Continue the overnight work sequentially.

## 2026-10-31 — P28: bounded local execution policies

Implemented `local-execution@0.1.0` and opt-in `http-service@0.3.0`. Compact/Balanced/Expanded are finite versioned CPU/memory/PID, init, on-failure restart and shutdown/grace presets; Balanced is default. The generator owns a policy descriptor, guide and Compose settings, while the new HTTP wrapper delegates only its three conflicting defaults. Existing HTTP versions, no-policy output, runtime/recipe/starter archives and live qrwty remain unchanged. Policy configuration seeds no implementation task and preserves project-owned source; ordinary generated-file ownership refusal remains active. Removing it restores Compose defaults and follows the generator's existing orphan-file retention/reporting.

Added the mouse preset editor with effective values, fixed Save/Cancel, stale-draft handling, undo/reload and actual C4 container/scope metadata; policies do not become fictitious application components. Screenshot review exposed the shared configuration-dialog class reaching Mantine's positioning container as well as its content. Scoped the flex layout to the content, fixing oversized short dialogs and blank space below actions; related starter/workspace/resource/evidence journeys passed. Added the settings icon and clearer empty-component guidance. Temporary geometry instrumentation was removed. Screenshots and limitations are in `docs/evidence/p28/`; Docker semantics and release boundaries are in `templates/local-execution/README.md`.

Verification: focused offline profile `2026-10-31T09-34-14-480Z-unit-9ae27711` passed 34 tests/3 files (1.7s). Final named disposable proof `2026-10-31T09-45-06-163Z-local-execution-a43241f2` passed in 68.6s: six template checks, no skips; exact installed Docker settings and cgroup-v2 CPU/memory/PID ceilings; one nonzero process-exit restart/readiness recovery; in-flight request drain/exit 0; manual stop remains stopped; a stuck external handle exits 1 at 20.639s using installed 25s Docker grace without a timeout override. Integrity passed and isolated output/container/network/image were cleaned; no model calls. The initial hanging-Promise fixture exited naturally without an active handle; the final fixture models the actual stuck resource. Fixture crash/hang routes never enter generated defaults.

Final policy/resource/connection browser profile `2026-10-31T09-43-31-930Z-browser-ec767201` passed 6 journeys (13.0s); starter/workspace/evidence journeys also passed in `2026-10-31T09-42-27-787Z-browser-2521cc84`. That broader run had one coordinate-based connection-selection timeout, which passed on the focused rerun. Existing delivery journeys passed earlier. Strict browser diagnostics stayed enabled; axe exposed and prompted a heading-level fix. Final required gate `2026-10-31T09-46-28-727Z-check-940baf35` passed in 39.4s: lint (627 files, 353 warnings/70 infos, no errors), all typechecks, 624 offline tests/91 files. Catalog/chat expectations were updated for the added template versions after the first gate identified their old counts. Passing profiles reported unchanged source fingerprints. Diff/ownership and screenshots were reviewed.

Preserved all pre-existing editor/review/handoff work, including the 52 unstaged handoff lines, `docs/improvements.md`, untracked `docs/build-plan-next.md`/`docs/reviews/`, and qrwty's `business-analysis/`. No paid agents, live regeneration, cloud deployment or exhaustive capacity/chaos campaign. Resource limits are ceilings, not throughput or availability guarantees; unsupported cgroups produce explicit skipped enforcement evidence in ordinary template verification. Next bounded package: **P29 reviewed compatible template upgrades**. The current subtype picker destructively resets existing configuration/attachments even for a newer version of the same template; make allowlisted compatible upgrades preserve the application before considering a separately specified horizontal pool.

## 2026-10-31 — P29: reviewed compatible template upgrades

Added a closed reviewed catalog for HTTP 0.1→0.2, 0.2→0.3, 0.1→0.3 and web-app 0.1→0.2. `upgradeTemplate` carries exact source/destination/review revision and checks available manifests, unchanged effective configuration/ports and retained attachment compatibility/limits. It changes only the template reference within the existing atomic edit/history pipeline. Existing schema-1 documents retain the ordinary lossless schema-2 canonicalization. Stale/unknown/reverse/cross-template/protected-recipe/default-drift/port-drift cases refuse; recipe detachment plus upgrade in one batch cannot bypass the release boundary. Same-template version replacement through updateElement/changeSubtype is refused rather than discarding the application.

Inline and inspector version choices now open a compact review with newly available capabilities and retained IDs. Save/Cancel, undo/redo/reload, layout/context/resource preservation, dark/light/narrow accessibility and stale conflict behavior are proven. Additional capabilities remain explicit choices. Protected recipes show their refusal before a mutation. Chat's subtype-review tool returns the compatible review instead of an unusable discard confirmation, and exposes the same typed operation for a requested upgrade. Different template families keep their existing reviewed destructive behavior. See `docs/templates/compatible-upgrades.md` and `docs/evidence/p29/`.

Offline profile `2026-10-31T09-52-34-042Z-unit-bd0f3510` passed 34 tests/2 files (1.4s), including all four paths' runtime/contract/Compose/dependency equality, atomic refusals, starter custom source/private setup and owned-file protection. Chat/schema follow-up `2026-10-31T10-00-28-735Z-unit-962cf24b` passed 11 tests/2 files (0.7s). Named disposable proof `2026-10-31T09-53-59-497Z-template-upgrade-b212a45a` passed in 78.3s: actual starter HTTP upgrade, unchanged prior output/private setup, explicit local policy selection, 21 template checks, two explicitly inapplicable stateless REST checks and the complete bounded account/owner/forms/relationship-record paging/session/accessibility journey. Frozen archives, generated integrity, project extras and credentials were retained; cleanup completed; zero implementation tasks/model calls. Subsequent equivalent failure-message handling avoids printing private setup in assertion diagnostics.

Browser profile `2026-10-31T09-57-11-375Z-browser-e8b0f57f` passed four upgrade/subtype/connection journeys (9.8s), including one explicitly scoped stale-review HTTP 409. The existing reconnection test's intermittent timeout came from reading the committed API state before the new edge rendered, then clicking the old path. It now waits for the accessible reconnected edge before measuring geometry. No application error suppression or interaction change. Required gate `2026-10-31T10-01-06-319Z-check-6f5ab2de` passed in 37.9s: lint 631 files (379 warnings/70 infos, no errors), all typechecks and 629 offline tests/92 files. The first gate identified one stale operation-count expectation and formatting; both were corrected. Source fingerprints remained stable during passing runs. Diff and all screenshots were reviewed.

No live qrwty/data regeneration, immutable runtime/recipe/starter changes, paid agents, deployment or exhaustive certification campaign. Preserved the original 52 unstaged handoff lines, improvements edit, untracked next-plan/reviews and qrwty business-analysis work. Final screenshot review showed that the current C4 grid can route a long connection behind an intermediate container and crowd relationship labels, although the logical model is correct. **P30 should fix deterministic C4 layout/routing and preserve camera/selection/board layout first.** Use the automation-pitch layout-engine precedent where appropriate; local multi-instance pools remain a subsequent separately bounded contract/proof, with state/session/rate-limit assumptions audited before eligibility.

## 2026-10-31 — P30: deterministic C4 layout and real mouse inspection

Replaced C4's grid/heuristic routes with pinned `elkjs@0.12.0` layered orthogonal geometry, stable identity ordering/seed, explicit label boxes and actual compound scope membership. Independent responsibilities use an invisible box-packing group; no fictitious dependencies or semantic objects are created. Global shape/edge/label coordinates preserve direction and stable IDs. The model-order strategy option crashes sparse compound graphs in this ELK release, so it is omitted and covered by a focused fixture. Automation-pitch's layout separation informed the original adapter; no application source was copied. Complete ELK license/source notices ship with the unchanged browser worker.

Each uncached layout uses a worker with 15s deadline and termination on completion/cancellation, stale-result rejection and a 16-entry geometry cache. Failed layout stays visible with Retry. Selection/evidence refresh retains geometry and settled camera; the initial fit runs once, with explicit flow direction, Fit View and selected-object focus. Derived coordinates never touch design/board storage. Real mouse verification exposed read-only wrappers blocking card buttons; explicit card pointer events restore direct inspection and label hover text. Dark selected-level contrast and long scope-heading clipping were corrected. Component overview uses a readable minimum zoom and can crop outer peers; pan/Fit View/inspector remain available. Narrow whole-diagram fits are overviews, not arbitrary-graph readability guarantees.

Added `pnpm work run browser-preview <specs | all>`: build production web assets and run the same strict journeys against the isolated test API/database and loopback preview. Geometry profile `2026-10-31T10-17-30-854Z-unit-4a706a57` passed four cases (1.1s): directed/scoped coordinates, deterministic ordering, label/card avoidance, cycles/parallel/self links, sparse components and invalid/empty geometry. Actual production layout/worker-retry/mouse/selection/refresh/narrow/light/dark journeys `2026-10-31T10-25-29-263Z-browser-preview-b502bdc4` passed two cases (6.9s including build); existing architecture/evidence regressions `2026-10-31T10-23-46-731Z-browser-preview-baea768e` passed four cases (8.9s). The negative worker-construction fixture is explicitly controlled; real subsequent layout uses the unmodified worker. Browser diagnostics remain strict. Async checks now wait for layout/camera completion and actual card count, avoiding vacuous loading-state passes. Screenshots were inspected and retained in `docs/evidence/p30/`.

Required gate `2026-10-31T10-25-43-590Z-check-95eb907d` passed in 38.2s: lint 636 files, 387 warnings/70 infos, no errors; all typechecks; 633 offline tests/93 files. Passing profiles have stable source fingerprints; `git diff --check` passes. Production worker SHA-256 `e4f5c51c6f2fd564bb64e52e81c4a85a316ef2f24f8b90e1db5eb886c765b030` matches the dependency bytes. Vite main-chunk-size warning remains; worker is a separate 1.60 MB asset. No broad diagnostic suppression, paid agents, live regeneration, frozen runtime/template/starter/recipe changes or exhaustive graph/performance certification. Original 52 unstaged handoff lines, improvements edit, untracked next-plan/reviews and qrwty business-analysis remain preserved; automation-pitch remains clean.

Updated original PLAN/current product review and maintenance documentation. Next bounded package: **P31 local HTTP pools, beginning with a state/session/rate-limit/migration/lifecycle eligibility audit**. Use a pinned mature proxy and focused disposable routing/loss/recovery evidence; reject unsupported state assumptions. No autoscaling, host/cloud failover, capacity guarantee or automatic live/recipe adoption. Continue the authorized overnight work sequentially.

## P31 — frozen local HTTP pool component and state audit (2026-10-31)

- Added experimental `@jeeves/http-pool@0.1.0`, with strict two/three-instance definitions, stable logical service/port, deterministic HAProxy configuration, active readiness/Docker DNS, finite connection/queue/time/resource/shutdown bounds, no retries or redispatch, untrusted forwarding-header removal, loopback publication and restricted proxy container. Final compiled archive SHA-256: `f04ce4ade417f95aff87b89d73b02b096e731e411b7f1c2beac0234d6e17eaa5`. The official HAProxy 3.4.7/Alpine 3.24 image is pinned at index digest `2caaf8b1a1ef67f3f1ea9b721f2821675d3ba4500fb518e23884fecb93e8dbaa`; its software release is 17 days old. Recorded image build revision/date and verified the upstream source archive checksum/license. No upstream implementation was copied or modified.
- Recorded the current state/lifecycle/ownership audit in `docs/reference/local-http-pool-audit.md`. Shared generated sessions/CSRF, owner data and advisory-locked migrations support the bounded consumer. Arbitrary project features, schedules, delivery workers, process/filesystem state and unreviewed handlers do not inherit eligibility. Five database connections per instance multiply to ten/fifteen before other consumers. The old HTTP replicas hint still does not deploy a pool.
- Added `pnpm work run local-http-pool`: consumes the compiled archive around a fresh generated Inventory app, injects fixture-only controls, proves both instances route traffic, shared session/resource continuity, another owner's 404, single effect after committed/disconnected write, readiness exclusion/all-unready bounded failure, stop/recreate DNS recovery, actual Docker limits and in-flight soft-stop draining. Reuses the strict six-group resource browser journey and cleans its isolated containers, volumes and output. Final run `2026-10-31T10-48-55-823Z-local-http-pool-bd30766b` passed in 76.7s with unchanged source fingerprint. Earlier fixture failures corrected the intentional-loss GET polling window and starter State label; ordinary diagnostics and all mutations remain strict.
- Focused offline checks passed 3/3. Required `pnpm work run check` passed in 37.5s (`2026-10-31T10-50-34-047Z-check-3cf64936`): lint/typecheck and 636 tests across 94 files; lint retains 398 warnings/70 infos and zero errors. Reviewed the source/lock/artifact diff, source hashes and actual generated desktop/narrow screenshots in `docs/evidence/p31/`. Refreshed workflow and original-plan/product review. No paid agent/model implementation, live qrwty adoption, deployment or broad certification campaign.
- Limits/next: P31 is a separate experimental component plus disposable composition, not diagram generation. Runtime proof covers the default pair; the third instance is definition-tested only. Proxy and database remain single failure points; no throughput, public ingress, global throttling, WebSocket/SSE or host-failover claim. P32 is the next bounded package: explicit visual composition/eligibility/owned output and C4 deployment metadata, preserving logical application identity. Existing applications and frozen templates/recipes remain unchanged. Pre-existing handoff/review/editor work remains unstaged.

## 2026-10-31 — P32: explicit local HTTP pool composition and eligibility

Added opt-in `local-http-pool@0.1.0` and compatible HTTP 0.4.0, preserving all prior versions and frozen recipes/starters. Closed eligibility requires the reviewed session/owner-resource API, one Postgres store, explicit per-instance execution policy, safe identity/port and legacy replica hint one; implementation notes/extensions/other behavior capabilities require separate review. Reviewed HTTP 0.1/0.2/0.3→0.4 upgrades preserve configuration/attachments/identity. Pool source checks run before writes and before application verification: modified startup/build/scripts/dependencies/migration scaffolds, custom executable/configuration files and symlinks are refused. Fingerprints permit ordinary comments/display metadata and known install/build output; Docker parser directives remain meaningful. This recognizes supported generated shape, not arbitrary program correctness or hostile-user security.

Generation verifies the P31 frozen manifest/archive/definition source, then projects the fully merged API into two/three named instances plus the pinned proxy at its original logical Compose name/port. Protected config/descriptor/guide and lock bindings retain source ownership, database/private environment and frontend origins. Each instance receives the selected local limits. HTTP lifecycle/configuration and execution packs target every physical instance; REST/browser checks use the proxy and Postgres sees real application credentials. Pool pack verifies physical wiring/readiness. No extra C4 application/component or implementation task is created; pool removal restores next-generation ordinary Compose and retains old artifacts as reported orphans.

The finite pair/trio mouse editor includes effective shared connection budget, prerequisites, local limits, Save/Cancel, undo/reload and stale-draft refusal. C4 shows declared policy separately from application responsibilities. The browser journey exposed/fixed a low-contrast notice title and missing architecture notice close label. New named profiles cover full generated Trio, browser-only diagnosis and a tiny controlled no-store-stream diagnostic. Documentation, original PLAN current guidance and the Excalidraw/automation-pitch product review were updated; screenshots are in `docs/evidence/p32/`.

Verification: full generated Trio `2026-10-31T11-43-47-057Z-generated-http-pool-5529cb43` passed in 115.3s: 23 logical template checks (HTTP/execution checks applied to all three instances), two explicitly inapplicable stateless REST checks, six strict resource-browser groups, private setup/additive extras/frozen archives retained through preset regeneration, zero implementation-model calls and isolated cleanup. Chromium editor journey `2026-10-31T11-21-35-406Z-browser-a8e3b071` passed (one journey, 7.1s test / 10.9s profile); selected existing delivery/local-execution journeys passed earlier. Focused final pool boundaries `2026-10-31T11-49-44-548Z-unit-26060ec6` passed four tests (1.9s). Final required gate `2026-10-31T11-50-09-070Z-check-89bacdfa` passed in 40.1s: lint 657 files (424 warnings/74 infos, no errors), all typechecks, 640 tests/95 files. Catalog expectations and one script type reference were corrected after earlier gates; the dangling-root case respects the existing earlier migration-ownership refusal and independently tests the pool preflight. Passing profiles reported unchanged source fingerprints. Final diff and actual screenshots reviewed.

Explicit verification refinement: real multi-write no-store/manual-stream responses expose upstream Chromium's false `ERR_ABORTED` after page EOF (Playwright #42742). Isolated controls reproduced it on Chromium 153.0.8010.12, 156.0.8078.4 and 156.0.8078.12; no eligible newer tested build fixed it, so dependencies remain unchanged. Pooled resource journeys explicitly use pinned Playwright 1.63.0 / Firefox 155.0; Jeeves editor and ordinary account-entry checks retain Chromium. `browser-stream` passed three complete streams plus real truncation/abort detection in 3.9s (`11-46-39-533Z-browser-stream-dd638a76`); `browser-stream-chromium` honestly failed in 0.9s (`11-46-51-483Z-browser-stream-chromium-3d1c681a`). No collector suppression, fetch monkeypatch, Worker, cache weakening or unbounded native reader was retained. Old default-Chromium resource profiles can still hit the upstream issue; use the small probe when evaluating a future stable browser. The frozen client and byte/time/no-store limits remain unchanged. Do not describe the failing Chromium case as passed.

Preserved the original 52 unstaged handoff lines, `docs/improvements.md`, untracked build-plan/review assets and qrwty `business-analysis/`; automation-pitch remains unchanged. No live qrwty regeneration, paid agents, cloud/public deployment or comprehensive load/chaos/certification campaign. Proxy and database remain local single failure points; arbitrary handlers/workers are unsupported. Next bounded package: **P33 declared local deployment inspection**, showing the actual selected proxy/instances/shared store and budgets separately from C4 identity, with clear declared-versus-running meaning and preserved camera/selection.

## 2026-10-31 — P33: readable declared local deployment inspection

Added the reusable read-only `localDeploymentView` projection to `@jeeves/spec` and a mouse-accessible Architecture dialog. It consumes the original frozen HTTP-pool definition and local execution presets, preserving one logical API while showing the declared proxy, actual named instances, real callers/stores/dependencies and scoped per-instance/API budgets. Spec now depends on the existing pure `@jeeves/http-pool` workspace package; no external dependency or released component source changed. Context-only relationships and the legacy replica hint never become runtime instances. Unsupported/incomplete policy and related readiness findings withhold the physical arrangement and show prerequisites.

The dialog labels its design revision and declared nature, keeps live health/evidence separate, provides an application selector and direct recorded-evidence/board-configuration actions. Opening/switching/closing preserves C4 scope, selection, camera, board layout and semantic revision. Fixed footer and responsive cards support mouse use in narrow/dark layouts. Screenshot review removed repeated headings and put aggregate API ceilings above the diagram; desktop shows proxy, all three instances and database together. Detailed shutdown/proxy/database budgets and local failure limits remain below it. There is no deployment, probe, model call or new runtime behavior.

Verification: focused projection `2026-10-31T11-57-35-983Z-unit-57b18c2e` passed three tests (0.8s). Production profile `2026-10-31T12-00-28-350Z-browser-preview-017048e4` passed three strict Chromium journeys (8.6s), including existing evidence/currentness/camera regression coverage. Final semantic-markup journey `2026-10-31T12-02-31-333Z-browser-preview-171df1cb` passed (7.1s): real configured starter Trio and second ordinary API, actual scoped budgets, legacy hint, dark/narrow axe, preserved document/layout/C4 camera/selection, evidence and board actions, incomplete-policy state. Required gate `2026-10-31T12-01-44-383Z-check-7619ee7a` passed (39.7s), lint/typechecks and 643 tests/96 files. An initial lint pass required native named sections instead of generic ARIA groups; final browser rerun checks that markup. Screenshots/diff reviewed; evidence in `docs/evidence/p33/`. Passing profiles report unchanged source fingerprints. Existing large-main-chunk warning remains; production assets and ELK worker load.

Current original PLAN and Excalidraw/automation-pitch product review now distinguish C4 intent from declared local deployment and recorded evidence. Only known HTTP/local-policy topology is covered; no arbitrary infrastructure/cloud graph, observed runtime health or capacity certification is implied. P32's upstream Chromium streamed-response diagnostic issue is unchanged. Preserved all unrelated editor/review/handoff work, frozen recipe/starter/runtime archives and live qrwty URLs/data/output. Next bounded package: **P34 focused durable-event authoring**, replacing the long all-events/payload form with focused selection and fixed actions while retaining immutable contracts, whole-draft validation and explicit domain handler work.

## 2026-10-31 — P34: focused durable-event authoring and overnight review

Replaced the all-events/all-fields delivery form with compact contract and payload selectors, one focused editor, finite policy summary and fixed Save/Cancel. Existing opaque draft identities now also drive selection: editing IDs/types/names and changing field kind retains focus; switching contracts remembers their last inspected field and every unsaved value. Add focuses the new item; removal selects a surviving neighbor. Default event IDs/type+version and payload names avoid current collisions after removals. No transient keys enter the semantic configuration, arrays are not reordered, and one Save remains one atomic edit. Existing immutable published-event history, runtime, ownership, business-effect handler and acceptance responsibilities remain unchanged.

Whole-draft schema validation disables Save even for hidden invalid fields/contracts. Invalid summaries and clickable issues expose the problem; the fixed Review action selects it, and an empty draft directs focus to Add contract. Cancel discards the full draft; stale 409/local revision refusal keeps it for review/cancellation. Screenshot review shortened repeated visible labels while preserving precise accessible names and aligned the identity controls. Existing shared dialog/theme is reused; narrow content scrolls behind reachable fixed actions. Published-contract/preset/handler guidance remains available without another theme or workflow engine.

Verification: initial focused/regression browser profile `2026-10-31T12-11-12-915Z-browser-79cec1bc` passed three journeys (10.5s). Final production profile `2026-10-31T12-13-57-062Z-browser-preview-4e83e5e8` passed three strict Chromium journeys (7.6s): existing C4/configuration/cancel/undo/reload and missing-database flow; multi-contract/payload selection, stable character typing after rename, remove/add name collision avoidance, hidden duplicate-enum validation/Review, atomic Save preserving the untouched event, exact stale 409 and retained draft, desktop/narrow/dark axe and fixed actions. Final required gate `2026-10-31T12-17-17-498Z-check-4258d900` passed in 38.4s: lint 664 files (436 warnings/74 infos, no errors), all typechecks and 643 tests/96 files, including the final empty-draft Review-focus correction. Passing profiles reported unchanged source fingerprints. Actual screenshots and scoped diff were reviewed; evidence is `docs/evidence/p34/`. No delivery-runtime/Docker conformance campaign was repeated for this editor-only slice.

Rechecked the current original PLAN/C4 commitments and the Excalidraw/automation-pitch visual principles; `docs/architecture-product-review-2026-10-31.md` now records the completed foundation through P34 and its actual limits. Read-only health requests returned HTTP 200 for Jeeves web/API and qrwty web/API; the live Jeeves registry exposes HTTP 0.4/local pool and all previous versions. qrwty has only its preserved `business-analysis/` untracked work; automation-pitch is unchanged. The source reference review/cache and named work profiles satisfy repeatable extraction/verification without another MCP layer. No paid Jeeves agent runs, live qrwty regeneration, public/cloud deployment or exhaustive certification campaign in this slice. Original QR identity/data, frozen artifact bytes and all pre-existing uncommitted editor/review/handoff work remain preserved.

Remaining limits: the independently reproduced Chromium no-store/manual-stream false-abort defect remains documented in P32; the strict pooled resource journey uses pinned Firefox without changing cache/byte/time limits or suppressing errors. Large main-bundle and existing lint warnings remain. Local pool/proxy/database are not host failover, throughput certification or arbitrary-state support. Domain handlers, arbitrary screens, organization-level authorization, general workflows and recipe/schema evolution remain explicit future contracts. Next bounded package: **P35 finite versioned business-action forms**, with a non-QR owner-scoped command consumer, session/CSRF/input/error/no-replay boundaries and immutable current releases. Do not conflate the form with its project-owned business effect or start cloud/workflow infrastructure. P35 has not been implemented.

## 2026-10-31 — QRWTY authoring, architecture and developer-testing audit

The user redirected attention to QRWTY and requested an audit of Jeeves verbosity, application-state control, account-gated entry/testing friction, missing frontend page flows and insufficient architectural detail. Recorded findings and a proposed sequential delivery plan in `docs/qrwty-authoring-review-2026-10-31.md`; linked it from the current improvement/product-review guidance so older P12/P35 next-work pointers do not drive automatic unrelated implementation. This is a documentation/review deliverable, not completion of a new numbered implementation package.

Read-only Chromium 153.0.8010.12 journeys inspected actual QRWTY `/`, `/login`, `/register` and the saved Jeeves project at 1440 × 1000. All QR entry paths show the same account gate. The API scope has eleven components but only two relationship edges, generated from the container wiring; the frontend has two components and no page-flow representation. Implementation notes fill diagram descriptions. Settled bounds show the API view clips its two external containers. Screenshots and observations are in `docs/evidence/qrwty-authoring-review/`. The saved project remains revision 4, has no context/recipe binding and contains one extra unbound Service; its three original elements match the generated design. Earlier recorded revision-1 evidence is not verification of the current full draft.

Found a concrete session-design issue: the runtime uses fixed `jeeves_session`/`Path=/`, and cookies are shared across ports on one hostname. A disposable two-server Chromium probe reproduced A receiving B's fixture cookie after B sets it. No real account/cookie was used. This can cause cross-app sign-outs; it does not establish the cause of the user's repeated registration. Existing returning-account login and seven-day session support were verified in source and existing restart acceptance. Recommend a small versioned session-cookie correction before the larger architecture, persistent dev-sandbox/tester access, page-flow/public-entry and composable-product work. The ordinary account journey must continue to work; developer access should establish real sessions in isolated persistent test state.

The plan separates executable page purpose/access/navigation/data from future companion theme/layout design, retains QR artwork functionality and records Puck/GrapesJS as unselected future candidates. C4 responsibility grouping must bind to real operations/resources/dependencies and allow direct configuration; shorter labels alone are insufficient. Existing QR recipe reproduction already avoids model calls, while fully editable capability composition/adoption needs work. Preserve immutable releases and prove any existing-project migration in a disposable copy before changing QR identities/data/source ownership.

Verification: `pnpm check` passed, exit 0; Biome checked 664 files with 436 warnings/74 informational diagnostics and no errors, all workspace/script typechecks passed, and 643 tests/96 files passed (Vitest 36.71s). Log: `/tmp/jeeves-qrwty-authoring-review-check.log`. Review links and `git diff --check` passed. Actual screenshots were visually inspected. No authenticated product regression or Docker generation suite was rerun for this documentation-only change. No account creation, application/API mutation, paid model run or runtime/code modification. Existing qrwty `business-analysis/` and the pre-existing 52 handoff lines, improvements edit, untracked build-plan-next/reviews remain preserved outside the review commit.

## 2026-10-31 — Fresh-agent specification for P35 session isolation

The user requested enough documentation for a fresh agent to start implementation and a paste-ready prompt. The prior audit supplied product direction but left the first package's release/transition/verification decisions open. Added `docs/build-plan-qrwty-authoring.md` as the authoritative bounded specification. **P35 now means independent sessions for local generated applications**; the earlier unimplemented business-action-forms proposal is superseded. P35 has not been implemented in this documentation turn.

Specified deterministic cookie identity from validated normalized public origin, unchanged authentication/CSRF/ownership/lifetime, no legacy-cookie fallback/clearing, and ordinary re-login with existing accounts after adoption. Defined new REST attachment 0.2.0/runtime 0.3.0 with preserved legacy release behavior/artifacts, explicit selection, existing mixed-runtime refusal and no misuse of the element-only compatible-upgrade operation. Required offline boundary/generation checks, a named compiled two-app same-browser proof, service restart and legacy-account/data transition, artifact integrity and cleanup. Live QRWTY adoption, tester auto-login, page flows and architectural redesign stay outside this first package. The queued architecture/testing/page-flow/composable-product work remains visible with completion goals, to be specified separately.

Updated PLAN, improvements, continuing-execution and review entry points to direct fresh agents to P35 only and avoid restarting historical P12 work or the old P35 proposal. Source pointers were verified against current runtime/template/generator/harness code. Local document links and `git diff --check` passed. Required `pnpm work run check` passed in 42.0s with unchanged source fingerprints: `.jeeves-work/runs/2026-10-31T15-00-38-884Z-check-b40cadf1.*`; lint 664 files, 436 warnings/74 infos/no errors, all types, 643 tests/96 files. No runtime, application, database, artifact or live design changes. Preserved the pre-existing unrelated work outside the documentation commit. Next agent: implement P35 from the new specification, verify, append evidence, commit with P35 in the title and stop before later packages.

## 2026-10-31 — P35: independent sessions for local generated applications

Completed P35 from `docs/build-plan-qrwty-authoring.md`, superseding the never-implemented business-action-forms proposal. Added explicit REST attachment 0.2.0 selecting frozen `@jeeves/rest-server@0.3.0`. Sessions use `jeeves_session_` plus the first 32 lowercase SHA-256 hex characters of validated normalized `PUBLIC_ORIGIN`'s `URL.origin`, including its port. One helper drives read/write/logout. Legacy, other-origin and unrelated cookies are neither accepted nor expired. Token generation/storage hashing, seven-day expiry, flags, exact trusted Origin/CSRF checks, owner filtering, response bodies and SQL schemas remain unchanged. New OpenAPI metadata explains the deployment-dependent name. Adoption or a public-origin change requires one ordinary login with existing credentials; no new registration/reset is needed.

Before modifying runtime source, packed legacy 0.2.0 from `cadf0b874e0759619d72f8eb2b0f6dc22470d57e`, recorded source hashes/build provenance and confirmed byte equality with the existing QR Studio frozen archive. Attachment 0.1.0 still selects this archive; old/default exports, stored design references, starter/recipe versions and artifact bytes remain available. Registered both versions without changing the element-only compatible-upgrade allowlist. The generator retains its mixed-runtime refusal; the harness now rejects ambiguous module sets before writes in either ordering. Frozen backend dependency/archive protection uses the existing mechanism; missing dependency manifests now receive a restore instruction. The golden legacy lock only gained the preserved archive hash/production-pin protection. Release SHA-256: legacy **`33c6fcc3890335dfa39d659a029244ead363c17e65777079470c23c15f5381c6`**, new **`a1dace57d6381a93e07201fa5d64ea887488216a6399298b14ef82b111869fc6`**. Verified all recorded source hashes and reproduced the new archive with a second pack; only session code, helper exports/declarations and package version differ in compiled output.

Verification and evidence (`docs/evidence/p35/README.md`; full `.jeeves-work/runs/<id>.log`/`.json`):

- Focused final offline runtime/command/generation/workspace/pool/catalog profile **`2026-10-31T15-49-18-000Z-unit-76de7a3e`**: **28 tests / 7 files**, 2.9s. Injection tests exercise both the compiled legacy runtime and current workspace source, normalized identity/default ports, reload/origin change, flags/lifetime/hash storage, ignored cookies, real authentication and CSRF/ownership boundaries, deterministic no-task generation, private/custom preservation and prewrite refusal. No listening sockets, Docker, Postgres or network for units. Earlier registry/recipe-focused pass: `2026-10-31T15-42-46-158Z-unit-d8dd2ccd`, 45 tests / 6 files.
- Selected existing REST conformance, extended to select each release independently: **`2026-10-31T15-46-07-052Z-templates-a964a312`**, **22 passed**, 109.7s. Both compiled archives pass REST/HTTP packs and generated consumer typechecking. No ambiguous all-version harness set is used.
- New **`pnpm work run session-isolation`**, **`2026-10-31T15-49-55-986Z-session-isolation-08107936`**, passed in **127.2s** with pinned **Playwright 1.63.0 / Firefox 155.0**, Node 24.21.0 and pnpm 12.16.1. Four independent generated outputs built/typechecked from frozen archives and regenerated with private setup/extras intact, with zero implementation tasks/model calls. A/B ran at different loopback public origins with separate databases in **one browser context**, alongside a legacy app. UI registration, distinct records, two-way login/refresh/logout, returning-account identity/data, fresh private-context anonymity, incorrect credentials, missing/wrong CSRF, wrong/missing Origin and cross-owner read/update refusal passed. Six existing passive REST contract/handler checks passed. Same-origin API restart preserved the current cookie/account/data. The transition changed only the disposable API image source to the independent new output; identical migrations, unchanged table OIDs, original account/resource IDs and successful existing-credential login prove storage/protocol continuity. Legacy-cookie-only access was anonymous, and new logout did not clear it. No protected-file hash bypass, cookie/token injection or mocked authenticated responses. Strict browser diagnostics remained active; actual final A/B screenshots were inspected.
- Required **`pnpm work run check` → `pnpm check`**, **`2026-10-31T15-50-15-935Z-check-25fef5ad`**, passed in **44.3s**: all workspace/script types, **656 tests / 98 files**; Biome checked 671 files, 462 nonblocking warnings/74 infos/no errors. All listed passing profiles reported unchanged source fingerprints. Final diff/artifact/ownership review, documentation links and `git diff --check` passed.
- Initial failures were test fixtures/expectations: omitted injected-contract error statuses, catalog/archive-count/golden-lock updates, earlier frozen-dependency refusal for a missing backend manifest, and the browser expecting API error wording instead of the existing UI wording. The initial browser run (`15-46-07-049Z-session-isolation-1556c016`) and gate (`15-46-07-048Z-check-fedd2d1b`) are recorded as failed, not passing. No authentication or diagnostic guard was weakened. Both browser attempts cleaned their disposable resources; final inventory checks confirmed no fixture containers/volumes/networks remained, and scoped teardown removed local images/temp generated output. No broad product/load suite was rerun.

Live QRWTY has **not** adopted this release. Its saved design, generated output, accounts/data/QR URLs and running processes were untouched; its pre-existing `business-analysis/` remains. Prior published recipes/starters/artifacts are unchanged. Preserved the original 52 uncommitted handoff lines, the unrelated historical improvements paragraph, untracked build-plan-next/reviews and all other unrelated work outside this commit. Status pointers now record P35 completion and its queued successor.

Limits: legacy apps still collide with other legacy apps; one session-backed app per public origin only, no same-origin path isolation, SSO or hostile same-host security boundary. The transition proves runtime/storage compatibility, not a polished protected-output adoption/attachment-upgrade workflow. P32's Chromium completed-stream defect remains; pinned Firefox preserves strict diagnostics and existing client/cache/stream bounds. Existing lint warnings remain; no load/chaos/cloud certification. Developer auto-login, public landing, page flow and architecture redesign were not implemented.

Next bounded authoring package to **specify before coding**: **useful QRWTY architecture**, with explicit responsibility/operation/resource/dependency bindings, concise cards, direct scoped configuration, context and fit. Persistent developer testing, page flow/public entry and composable QR adoption follow as separately specified packages. P35 is complete; stop after its scoped local commit.

## 2026-10-31 — P36 implementation handoff preparation

The user requested a paste-ready prompt and any additional Markdown needed by the next agent. Added `docs/build-plan-p36-architecture.md` as the bounded **P36 — useful application architecture, proved with QRWTY** specification. P35 remains completed in `6823880`; P36 is specified, not implemented. The new document includes the exact implementation prompt and supersedes the remaining stale next-package pointers without reviving the old P35 forms proposal.

Specified additive architecture responsibility/member metadata, stable references and visible lost bindings; generated versus declared dependency meaning; per-member ownership and complete endpoint/acceptance inspection; a reviewed five-responsibility QRWTY fixture covering all eight extensions plus accounts/resources; direct selected-object configuration reusing the resource editor; concise cards and settled fit including external containers. Required semantic/generation-invariance tests, a disposable QRWTY/non-QR proof, strict production editor journeys, mouse Save/Cancel/undo/redo/reload/conflict handling, screenshots/axe and the repository gate. No arbitrary call graph, source analyzer, runtime change, developer tester access or page-flow implementation is included. Existing live QRWTY/saved design and P35 artifacts remain read-only; the metadata composition is proved in disposable projects, with live adoption separately reviewed.

Inspected the current architecture schema/projection, workspace/cards/fit, resource-editor seam, API/recipe integration and existing tests, plus QRWTY feature registrations/storage use read-only. Corrected and verified source pointers and local documentation links. Updated current guidance in PLAN, improvements, continuing execution, P35 authoring handoff and review entry points; retained historical review findings and every earlier handoff entry. The next package after verified P36 is persistent developer testing, requiring its own specification; page flow/public entry and composable adoption remain later work.

Verification: `pnpm work run check` passed in **42.5s**, `.jeeves-work/runs/2026-10-31T16-07-42-855Z-check-b653e8cd.*`, unchanged source fingerprints during the run. Biome checked 671 files (462 warnings/74 infos/no errors), all workspace/script types passed, **656 tests / 98 files passed**. Final documentation links/source pointers and `git diff --check` passed. No runtime/source implementation, live application/design/data mutation, browser/Docker campaign or paid model calls in this documentation task. Preserved the pre-existing 52 handoff lines, historical improvements edit, untracked build-plan-next/reviews and qrwty business-analysis work outside the documentation commit. Next agent: implement P36 only from the new specification, verify, append evidence, commit with P36 in its title and stop.

## 2026-10-31 — Feedback review, existing-work checkpoint and integrated P36 scope

The user asked to review `~/.opencode/jeeves-feedback`, commit all existing Jeeves
changes and continue with one agent in the current checkout/branch. Read the
feedback text, inspected the two UI screenshots and editor sketch, and checked the
Excalidraw labels against the sketch. Compared the request with the latest handoff,
P36 specification and actual Draw/Architecture/inspector/chat/template seams.
Recorded the review in `docs/reviews/jeeves-editor-feedback-2026-10-31.md`, retaining
the original feedback, sketch and referenced screenshots in its dated assets.

Committed all pre-existing Jeeves changes as **`1c607d3` — `docs: checkpoint existing
product reviews and planning`**. These were documentation and review assets; the
only cleanup was one Markdown trailing-space line so the staged diff check passed.
No previous handoff entry was rewritten. Added the user's sequential current-branch
workflow to `AGENTS.md`; no branch, worktree or sub-agent was created.

Updated P36's specification to include the requested shared shell: left chat,
C1/C2/C3 editing, retained C2 board authoring, right-hand object/arrow-specific
configuration, selection/camera/draft continuity and mouse-reachable controls.
Retained its responsibility/member/dependency model, QRWTY/non-QR proofs and
generation-invariance boundary. The separate Architecture page alone no longer
satisfies this package. Corrected current PLAN/improvements pointers and marked
the newly checkpointed P12 specification historical. **P36 remains unimplemented**;
this turn prepares the work rather than claiming a completed implementation package.

Architecture UX takes priority; page flow/layout, new enterprise capability runtimes,
chat usage/context/answer review, developer testing and live QRWTY adoption remain
separate follow-ups. Asked whether not-yet-generatable enterprise capabilities
should appear as clearly planned objects or only working templates should appear.
Recommended the former; no answer was received during this review. This is a
follow-up scope decision, not a dependency for integrating existing editors in P36.
Use the user's later answer if it arrives; do not treat the recommendation as approval.

Verification: **`pnpm check` passed** before the documentation-only updates, exit 0;
Biome checked **671 files**, **462 warnings/74 infos/no errors**, all workspace and
script typechecks passed, **656 tests across 98 files passed** (Vitest **33.51s**).
Log: `/tmp/jeeves-feedback-baseline-check.log`. **51 local document links** in seven
changed/captured Markdown files resolve; `git diff --check` passed. Reviewed the
documentation diff and staged assets. No source changes justified another application
test run; no live browser/Docker verification or provider requests were made.
The running QRWTY app, its repository/data and saved Jeeves design were not changed.

Next implementation is the revised P36 in `docs/build-plan-p36-architecture.md`.
Use the current branch, finish its focused checks and handoff, and create its own
local package commit. Reassess architecture/template gaps against this feedback
before automatically resuming an older follow-up order.

## 2026-10-31 — P36: integrated C4 editor and reusable planned offerings

Completed the revised P36 specification in the current `main` checkout, with one
agent and no new branches/worktrees. The user explicitly approved planned
capabilities and prioritized editor/menu visuals, then requested a modular root
catalog and workload intent. This supersedes the older executable-only scope and
new generation/runtime certification campaign; implementation of the new templates
and stress-test harnesses remains deferred to future tasking.

Draw now hosts C1 context, the existing editable C2 board and scoped C3 responsibilities
in one shell with left chat and right selected-object/arrow controls. Retained
mouse placement, connection choices, resources, events, execution/pooling, deployment,
starters/recipes, Generate and evidence inspection. Added a searchable library with
20 planned C2 types, six planned C3 types and three editable SaaS architecture studies
(links/QR, community/discussion, social/content). Typed settings include workload
pattern, peak/unit and P95 targets where applicable; these save intent only.

Added optional responsibility/member metadata, explicit resource/connection uses and
C3 relationships, stable identity, duplicate/missing-reference validation and visible
lost bindings. Grouped members retain their actual contracts, ownership and acceptance
references. A new QR architecture fixture covers five responsibilities and all eight
extensions once; ungrouped capabilities remain visible. Direct resource configuration
reuses the existing editor. Planned objects/arrows block generation and cannot satisfy
real ports. No runtime template, frozen release, recipe, starter or lockfile changed.

Saved per-scope selection/cameras and dirty inspector drafts, preserved conflict drafts,
refreshed evidence after generation, and fixed rapid navigation racing a layout save.
Initial C1/C3 fitting uses measured bounds and an initialized viewport; this avoids a
controlled-node fit queue remaining pending during updates. Added readable overview
labels, bounded planned-card width and responsive mobile canvas/header sizing.

Created `CATALOG.md` with cross-linked C1 offerings, shared C2/C3 families and reverse
reuse, plus the C4 implementation/library and verification boundary. QR encoding is
normally domain/library code; a reusable future load harness can exercise representative
operations/data without certifying custom domain correctness. Added the catalog
maintenance rule to AGENTS.md and updated current documentation pointers while retaining
historical specifications and earlier handoffs. Evidence and six inspected screenshots
are in `docs/evidence/p36/README.md`.

Verification:

- Focused offline architecture/planning/generation/layout: **19 tests / 4 files**,
  **1.9s**, profile `2026-10-31T17-21-00-762Z-unit-98b48782`.
- Final production-build browser command (all 14 affected suites listed in evidence):
  **30 passed**, **23.4s** / profile **25.1s**, Chromium **153.0.8010.12**, Playwright
  **1.63.0**, profile `2026-10-31T17-37-47-184Z-browser-preview-646db5a1`. Real mouse/API
  edit, Save/Cancel, undo/redo, reload, conflict, declared relationships, delayed-layout
  navigation, existing executable configuration, chat, starter/evidence and responsive
  axe journeys passed with strict diagnostics and no retries. Providers are scripted;
  starter generation is write-only, not a new runtime/load proof.
- Required **`pnpm work run check` → `pnpm check` passed**, **42.0s**, profile
  `2026-10-31T17-38-37-548Z-check-2eac1dc6`: all workspace/script types; **665 tests /
  99 files**, Vitest **33.84s**; Biome **685 files, 511 warnings/75 infos, no errors**.
  These three passing profiles all report unchanged source fingerprints. Full logs and
  JSON are retained under `.jeeves-work/runs/`.
- Failed interim browser attempts exposed the corrected layout/navigation/validation
  defects and obsolete selectors/readiness assumptions. The concurrent gate/browser
  attempt `17-34-53-863Z-check-f3dc9a12` hit two existing five-second unit timeouts;
  the final gate passed separately without changing timeouts or weakening checks.
  Failed attempts remain recorded. Document links and `git diff --check` passed.

Read QRWTY source at `9bc5467` without modifying or running it. Live QRWTY source,
services, data/URLs, accounts and saved Jeeves design remain untouched. Removed 148
named session-created projects from `jeeves_e2e` and 230 session-created disposable
E2E settings/output directories; retained other projects and the shared Postgres
service. The existing Jeeves dev web/API remain healthy at 4300/4310.

Next: review the visible editor and catalog before specifying another package.
New template runtimes/generation/load tests, automatic topology/provisioning, general
C4 code diagrams, page flows, developer tester access, broader chat-context work and
live QRWTY adoption are separate follow-ups. Keep the one-agent/current-branch flow;
P36 finishes with its own scoped local commit.

## 2026-10-31 — JEEVES-2 editor and backend-design research review

The user asked to review and execute the instructions in
`Z:\home\ash\.opencode\jeeves-feedback\JEEVES-2.md`, resolved to the local
`/home/ash/.opencode/jeeves-feedback/JEEVES-2.md`. The file requests review of its
annotated screenshot, substantial C4 diagram research, planning notes and then
clarifying questions before major product decisions. Completed that research and
planning scope in the current `main` checkout with one agent, starting clean at
`e0f6165`. No new branch/worktree or delegation.

Added `docs/reviews/jeeves-feedback-2-2026-10-31.md` and retained the original
feedback/screenshot in the dated review assets. Text normalization changes only
line endings/trailing whitespace; the screenshot is byte-identical. The review
maps every marked control and textual request to proposed behavior, distinguishes
the circled Undo/Redo ambiguity, and records the current code seams. Updated the
PLAN/improvements/continuing-execution entry points to this review without changing
historical handoffs or claiming an approved/implemented P37.

Attempted Google Images through the web tool and a browser; Google blocked automated
access. Used available image search and original sources instead. Visually inspected
17 primary-source C4/Structurizr diagrams/variants (ten banking/AWS examples, seven
cookbook variants), read Medusa's architecture documentation and official OpenAPI,
Swagger, Scalar, Fastify and FastAPI documentation. Source links and per-view lessons
are in the review; temporary captures are in `/tmp/jeeves-feedback-research/`.
These are illustrative models, not independent enterprise capacity proofs.

Recommendations: remove marked permanent chrome, use a left-edge chat drawer,
selection-driven concise inspectors, useful C1 actors/purpose, stable type-family
colors and role-first type selection with versions in advanced settings. Keep the
existing OpenAPI 3.1/Fastify/Ajv foundation; present a complete endpoint list and
evaluate an embedded reference viewer. Keep code, data and traffic meanings clear
while connecting their navigation. Read the live QRWTY owner-analytics handler only
as source evidence for its real QR/scan/Postgres/library relationship.

Asked three product questions: focused C4 implementation versus a combined backend
canvas; moving crossed-out controls into contextual menus versus removing functions;
and responsibility-group versus endpoint-card C3 presentation. They remain pending
at this handoff. The recommended answers are not approvals. Next work is to record
the user's answers and specify a bounded package, beginning with editor simplification
if consistent with those answers. Do not automatically implement the entire proposal.

Verification: `pnpm work run check` → `pnpm check` **passed in 40.4s**, profile
`2026-10-31T18-45-05-722Z-check-a8e53984`, unchanged source fingerprints during the run.
Biome checked **685 files**, **511 warnings/75 infos/no errors**; all workspace/script
typechecks passed; **665 tests / 99 files passed**, Vitest **32.98s**. Checked **60 local
document targets**, original asset equality and `git diff --check`. The final handoff
is documentation-only. No new application tests were needed for this review.

No application/runtime/template/lockfile changes, dependency installs, live design
edits, account/data changes, provider calls or runtime/browser certification campaigns.
CATALOG availability and boundaries remain unchanged. Complete this review with its
own scoped documentation commit; implementation remains a separate package.

## 2026-10-31 — P37: editor simplification and contextual actions

Completed [P37](build-plan-p37-editor.md) sequentially on the existing `main`
checkout, starting clean at `3282fdb`, with one agent and no branches/worktrees.
Read the JEEVES-2 review, original feedback and annotated screenshot; did not repeat
its research. The user explicitly chose **focused C4 implementation with linked
data/traffic settings**, **contextual menus for retained actions**, and **C3
responsibility groups**. The first choice guides the separately scoped backend
follow-up; this package implements the bounded editor simplification only.

Implemented an initially collapsed left-edge chat drawer with its existing mounted
conversation/draft. One header retains navigation, parent application, Library,
Generate and mouse undo/redo. Editor/diagram menus retain object lookup, component
creation/relationships, context/product editing, findings, evidence, deployment,
flow direction and focus. Removed the permanent action row, Architecture label,
object picker, Findings tab, revision/footer counters and duplicate history buttons.
Selection opens concise details; inspector visibility restores per scope, and
clicking the selected C2 card reopens a dismissed inspector.

C3 uses one responsibility heading/purpose, compact method/path/response-media rows,
and disclosures for contracts, resource fields and implementation configuration.
Existing structured configuration remains reachable. Acceptance IDs are absent
from normal component/resource editing; event acceptance editing is behind
Verification metadata. Protected contracts and evidence retain their metadata.
Normal subtype choices show one entry per type and keep existing exact pins;
explicit version changes remain in inspector implementation details and use the
existing reviewed upgrade dialog. New selections use the registry's explicit
semantic-version ordering, not catalog array order.

Shared family colors/icons now cover C2/C3 cards, Library and inspector headings,
with separate selection, planned and issue cues. C1 uses saved purpose/actors/
interactions, and missing context offers an explicit setup action through the
existing editor. No context or responsibility grouping is silently inserted into
existing designs. Existing ungrouped components remain visible.

Visual/interaction fixes needed by this shell: prevent an empty-board resize from
queuing a fit that unexpectedly centers the first new item; fit C1/C3 against
measured bounds when the panel shrinks the canvas; restore per-scope panel state
so navigation retains the C2 camera; bound default C2 card width while preserving
saved resize dimensions and semantic/layout separation. Screenshots exposed
oversized intrinsic cards with newer templates' additional attachment actions.
No model, runtime, template, recipe, starter, generator or dependency pin changed.
Catalog offerings and boundaries are unchanged, so `CATALOG.md` is unchanged.

Verification and evidence:

- Final production-build browser command is listed in
  [P37 evidence](evidence/p37/README.md): **32 tests passed / 15 suites**, Playwright
  **24.8s**, profile **26.5s**, no retries, strict diagnostics and unchanged source
  fingerprints; `2026-10-31T20-04-23-930Z-browser-preview-8fd282c1`.
- Mouse selection/connections, menus, chat draft collapse/continuity, context
  Save/Cancel/undo/redo/reload, planned and configuration conflict drafts, explicit
  upgrade boundaries, evidence/deployment, resources/workspaces/events and starter
  generation passed. Axe checks cover desktop/narrow/dark screens and configuration
  dialogs. Providers are scripted; generated output is disposable and write-only.
- **`pnpm work run check` → `pnpm check` passed**, **44.3s**, unchanged fingerprints,
  profile `2026-10-31T20-05-56-648Z-check-d8cf1f71`. All workspace/script types passed;
  **665 tests / 99 files**, Vitest **37.07s**; Biome **687 files, 514 warnings/74 infos,
  no errors**. Only evidence/handoff documentation changed afterward.
- Opened and visually inspected seven final screenshots: C1 empty/setup, saved
  actor editing, QR fixture context, C2 container types, concise C3 analytics,
  expanded chat and 390px dark context. The evidence directory retains them.
- Interim browser failures and logs are retained. They exposed the corrected
  contrast/fit/card-width/scope-camera issues and old test assumptions about
  permanent controls, acceptance/version text, implicit selection and Undo location.
  No timeout increase, diagnostic suppression or retry was added. `git diff --check`
  and local documentation link checks passed.

Removed 87 named projects created by this session from `jeeves_e2e` and 132
session-created E2E temporary settings/output directories, retaining existing
projects, logs and the shared Postgres service. Existing Jeeves API health is OK
on 4310. Live QRWTY source, services, URLs/accounts, saved design and data were not
edited. Work remains in the current checkout for its scoped local P37 commit.

Next: separately specify the complete API operation/reference workflow and selected
contract authoring, then the approved focused implementation view with explicit
handler/library bindings and linked data/traffic settings. No embedded API viewer,
combined backend canvas, general code graph, new runtime, deployment authoring,
page flow, developer-testing service or live adoption was built here. Keep those
bounded and continue the one-agent/current-branch/local-commit policy.

## 2026-10-31 — P38: saved-design API contracts and reference

Completed [P38](build-plan-p38-api.md) in the existing `main` checkout, starting
clean at `0627fe5`, sequentially with one agent and no branches/worktrees/delegation.
Read AGENTS, PLAN/editor architecture, the latest two handoffs, P37 specification
and evidence, and the JEEVES-2 review. Did not repeat C4 research. The approved
focused C4/linked settings, contextual menus and responsibility groups remain the
direction; this package is bounded API contract/reference work.

Added a contextual API workspace listing generated sessions, resource CRUD and
existing extensions exactly once per REST capability. Rows show complete paths,
methods, documented purposes and success media/types; selection shows inputs,
access and all statuses/media/headers. C3 responsibility members open their same
operations. Generated CRUD reuses the existing resource editor. Project extensions
edit supported GET/POST route/access/notes and the existing single-operation JSON
contract, with whole-model validation and no lossy schema projection. Unsupported
contract fields/methods and duplicate CRUD routes fail with the draft retained.
Closing/switching selection or scope retains drafts; Cancel clears them; Save,
undo/redo/reload and revision conflicts use the existing semantic operations.

The new no-store API preview compiles a saved revision with `resourceContract` and
the exact pinned REST version. It performs no generation or application requests;
legacy project-owned/invalid/missing-template contracts are explicitly unavailable.
UI labels distinguish saved design preview from a running application's possibly
older contract. The compiled document is unchanged; display-only grouping/purpose
labels and selected-operation filtering operate on a clone.

Evaluated Swagger UI against real contracts before integration, then added exact
`swagger-ui-dist@5.33.3` (published October 15, sixteen days old). It is lazy-loaded
from local assets in an opaque sandbox; execution, authorization controls, query
configuration and external validation are disabled, with CSP `connect-src 'none'`
and a rejecting request interceptor. Vendor CSS is locally inlined; no CDN assets.
Small contrast adjustments pass the exercised viewer accessibility check. The
optional Scarf installation script is explicitly disabled. Dependency source,
size, fit-check procedure and limitations are in [P38 evidence](evidence/p38/README.md).

Recipe contracts remain read-only here. The shared edit API additionally rejects
new incompatibilities in valid recipe bindings using existing recipe validation;
old invalid designs can still be repaired. No template/runtime pin, builder body,
generated fixture/golden output, catalog offering or C1–C3 boundary changed.
The only template-package change exposes its existing builder through an export.
`CATALOG.md` therefore remains unchanged. No live QRWTY adoption, source/service,
saved-design or data changes.

Verification:

- Final production browser profile `2026-10-31T20-27-53-659Z-browser-preview-1afc4c29`:
  **23 tests / 8 suites passed**, **18.7s** Playwright / **21.2s** profile, no retries,
  strict diagnostics and unchanged source fingerprints. The exact command is in
  the evidence README. Covers JSON, PNG/binary and redirect/header contracts,
  non-QR inventory, CRUD reuse, protected recipes, retained invalid/conflict drafts,
  Save/Cancel/undo/redo/reload, P37 chat/selection/compact shell and explicit upgrades.
- Opened and inspected six final screenshots: operations, PNG, redirect, inventory,
  conflict and narrow/dark. Axe covers the API workspace and the actual sandboxed
  PNG viewer, plus existing editor/configuration suites. No application/validator
  requests or external viewer assets were observed.
- **`pnpm work run check` → `pnpm check` passed**, profile
  `2026-10-31T20-28-31-424Z-check-50e93611`, **42.2s**, unchanged fingerprints.
  Workspace/script types passed; **672 tests / 101 files**, Vitest **34.41s**;
  Biome **697 files / 546 warnings / 75 infos / no errors**. Preview tests compare
  the complete builder document for both old/new pins and prove non-mutating saved
  revision reads. Existing generator golden/compatibility checks pass unchanged.
- Interim failures/logs are retained. Fixed viewer contrast/focus, repeated headings,
  obsolete selectors and test setup/type errors. An overlapping unit/browser run
  exposed a restart-test timeout and premature camera snapshot; final gates ran
  separately with unchanged timeout/retry policy. Resource-test deletion now waits
  for C2 navigation's layout flush, and upgrade tests establish a saved mouse-chosen
  camera. Strict diagnostics were retained, with only the intentional exact 409
  scenario registered.
- Removed **46** named session test projects from `jeeves_e2e` and **114** session
  E2E settings/output directories; retained existing data/logs/Postgres. Stopped
  temporary viewer server 4398; existing Jeeves health on 4310 remains OK. Only
  evidence/planning/handoff documents and screenshot copies changed after checks.

Limits/next work: this is a design reference, not runtime/binary-decoding/load
certification. Existing project extensions use supported contract JSON detail;
new operation creation, general OpenAPI import/export and broader methods need
separate scope. The existing builder's PATCH schema still uses creation-input
requiredness while runtime updates are partial; P38 preserves generation and notes
partial updates in the concise detail view. Follow up separately on the approved
focused C4 implementation/handler/library bindings with linked data/traffic settings,
then broader backend data/deployment authoring, new runtimes, source analysis and
live adoption. Planning entry points now point to P38 and these boundaries.

## 2026-10-31 — P39: C4 container notation on the C2 board

Completed [P39](build-plan-c4-saas.md#p39--c4-container-notation-on-the-c2-board) in the
existing `main` checkout, starting clean at `3d4fb0f`. One agent, sequential work,
no branches/worktrees/delegation. Read AGENTS, PLAN §1–§15, the recorded P39–P45
decisions and latest P37/P38 handoffs. Did not repeat the C4 research.

Added optional bounded element descriptions and technology metadata through the
normal schemas/atomic updateElement operation. Implemented technology labels use
a spec display map; planned blocks allow free text and otherwise follow their
engine option/default. Unspecified technology stays explicit. Cards show a
stereotype, name, technology and responsibility, at most two chips and compact
capability icons; notes no longer supply planned card descriptions. Below zoom
0.55, descriptions/chips hide. Type-label clicks use the existing reviewed subtype
workflow; inspector subtype/version controls preserve existing pins and reviews.
Description Save/Cancel retains drafts across selection and revision conflicts;
planned descriptions/technology save with the existing options batch.

A derived dashed boundary follows measured non-external containers and the system
name. Context people/external systems with system relationships appear outside;
bound relationships target the container, unbound ones the boundary. Planned
external blocks render outside too, without overwriting authored layout. Derived
identities never enter annotations or saved layout. C2 context selections and Find
object reuse the existing context editor, including Save/Cancel/history/reload.
Family colors, grey external systems, database cylinders and person glyphs have
separate status/issue/selection cues. A scope caption and measured inner stage keep
all mouse controls within the canvas. Compatible add-capability buttons became
compact accessible icons to preserve selection geometry and avoid oversized cards.

Verification and inspected captures are in [P39 evidence](evidence/p39/README.md):

- Final production browser command lists fourteen suites: **38 tests passed**,
  Playwright **28.2s** / profile **30.0s**, no retries, strict diagnostics and unchanged
  fingerprints; `2026-10-31T20-58-04-769Z-browser-preview-d0e62f7d`.
- Description/technology Save/Cancel/undo/redo/reload, retained 409 drafts, context
  editing/unbinding, subtype review, exact/protected pins, placement, native dragging,
  selection/resize, C1/C3 continuity, API reference, resources, events and scripted chat
  passed. Axe covers desktop/narrow dark C2 and exercised inspector/configuration
  surfaces. Fit assertions include every node, actual viewport and mouse controls.
- **`pnpm work run check` → `pnpm check` passed**, **43.8s**, unchanged fingerprints;
  `2026-10-31T20-58-35-024Z-check-77e8d978`. All workspace/script types passed;
  **677 tests / 103 files**, Vitest **35.99s**; Biome **703 files**, **561 warnings /
  75 infos / no errors**. Generator golden/ownership checks remain unchanged; new
  tests compare all generated artifacts except the lossless input design snapshot.
- Opened and visually inspected six final screenshots: QR architecture and the
  eight-container link platform at **1440 × 900 light** and **390 × 844 dark**,
  retained description conflict, and an unbound context relationship.
- Interim logs remain. Corrected boundary hit testing, color variables/tool-hint
  overlap, control clipping from React Flow's fixed inline wrapper sizing, stale
  inline subtype/tab selectors, moving native-drag targets and premature reload
  after Redo. Accessibility scans wait for closing menus/dialogs to unmount.
  No timeout/retry increase or diagnostic suppression. `git diff --check` and new
  local documentation targets were checked before commit.

No template/runtime/recipe/generator implementation, dependency pin/lockfile,
golden fixture or live QRWTY edits. The existing generated input snapshot retains
metadata losslessly; runtime artifacts and ownership ignore it. No offerings,
availability or reusable C1–C3 boundaries changed, so CATALOG.md is unchanged.
Only evidence/planning/handoff documentation changed after the gates. Removed
**165** exact-name/session-time test projects from `jeeves_e2e` and **172** newly
created E2E settings/output directories; retained existing data, logs and shared
Postgres. Existing Jeeves health on 4310 remains OK.

Next: **P40**, relationship labels, protocols and sync/async line semantics. Existing
kind-name labels, planned-edge dashes and arrow/card overlaps in authored layouts
remain visible and are not P39 claims. Legacy planned examples retain unspecified
technology until explicitly selected; their reviewed refresh is P43. Narrow diagrams
are fitted overviews with mouse zoom/selection for detail. Continue the recorded
package order/current-branch/local-commit policy; no runtime or live adoption work.

## 2026-10-31 — P40: relationship labels, protocols and line semantics

Completed [P40](build-plan-c4-saas.md#p40--relationship-labels-protocols-and-line-semantics)
in the existing `main` checkout, starting clean at `fcfe48b`. Read AGENTS, PLAN
§1–§15, the recorded C4 decisions and latest handoffs. One agent, no delegation,
branches or worktrees; no repeated external research.

Added optional bounded executable-connection label/protocol/interaction metadata,
shared with planned relationships. `updateConnection` changes presentation atomically
without replacing/reordering wiring. Defaults use current target names and SQL or
HTTPS/JSON; generic dependencies remain Undecided. The inspector provides explicit
Save/Cancel, dirty draft retention through selection/conflicts and existing history.
Planned protocol selection now accepts bounded text in the existing inspector.

C2/C3 show verb phrases and protocols separately. Request/response is solid, async
dashed and streaming dotted; Planned is a badge independent of interaction. The
existing legend explains styles. C3 connection uses inherit presentation; resource
uses name their selected resources and aggregate by their existing store connection.
“Declared use” and “Uses store” no longer render. Declared component relationships
retain stored descriptions, with optional protocol/interaction controls in the same
dialog. No per-use override or new dialog was necessary. C1 descriptions/line styles
remain unchanged and contain no protocol. Context intent at C2 shows Undecided;
transport is not inferred from prose.

Screenshot-driven adjustments keep C2 labels clear of measured cards/earlier labels
inside fitted object bounds, with thin leaders when displaced. Saved positions/layout
and authored arrow routing stay intact. C3 reserves label/protocol/badge space for
its overview font, preventing text overlap. Existing arrow crossings remain.

Verification and all fifteen inspected captures are in [P40 evidence](evidence/p40/README.md):

- Final **`pnpm work run browser-preview`** command lists ten suites: **36 tests passed**,
  Playwright **26.0s** / profile **27.8s**, no retries, strict diagnostics and unchanged
  fingerprints; `2026-10-31T23-09-15-415Z-browser-preview-c3f68a50`.
- QR plus all three examples have verb/protocol labels at C2/C3, solid default
  executable lines, dashed async planned lines and separate Planned badges. Browser
  assertions check label/card/label separation within the viewport and nonoverlapping
  C3 text. Mouse Save/Cancel/undo/redo/reload, retained 409 drafts, declared async and
  planned streaming persistence pass. Existing C1/configuration/placement/chat/API
  reference journeys pass; axe covers desktop C2/C3, narrow dark C2 and existing forms.
- **`pnpm work run check` → `pnpm check` passed**, **45.2s**, unchanged fingerprints;
  `2026-10-31T23-10-01-560Z-check-adbb57ab`. All workspace/script typechecks passed;
  **686 tests / 105 files**, Vitest **37.69s**; Biome **710 files**, **577 warnings /
  75 infos / no errors**. Generator golden/ownership fixtures are unchanged. Added
  comparisons prove edited metadata leaves generated artifacts/wiring/ownership
  identical for the QR architecture fixture and protected recipe, except the existing
  lossless input design snapshot.
- Interim logs retain the corrected inspector-state/narrow-panel assumptions,
  clipped/colliding labels and C3 text spacing. The first full check caught a stale
  new-test API-suffix expectation and an existing PGlite migration-test timeout while
  browser tests ran concurrently. Corrected the assertion; final gates ran sequentially
  without timeout/retry increases or diagnostic suppression.

The small extensions to declared component metadata and label geometry complete
N7–N9 within existing surfaces; they add no runtime behavior. No template, runtime,
recipe, generator implementation, dependency pin/lockfile, golden or live QRWTY edits.
Catalog offerings, availability and reusable boundaries are unchanged, so CATALOG.md
is unchanged. Only evidence/planning/handoff documentation changed after final gates.
Removed **36** exact-name/session-time E2E projects and **70** session-created temporary
settings/output directories, retaining pre-existing data/logs/shared Postgres.
Existing Jeeves health on 4310 remains OK.

Next: **P41**, missing SaaS containers in the C2 planning catalog, followed by the
recorded package order. Existing example content/technology refresh remains P43;
narrow views remain mouse-zoomable overviews. Follow the current-branch, one-agent,
scoped-local-commit policy. No runtime expansion or live adoption is implied.

## 2026-10-31 — P41: missing SaaS containers in the C2 planning catalog

Completed [P41](build-plan-c4-saas.md#p41--c2-catalog-missing-saas-containers) in the
existing `main` checkout, starting clean at `07a8548`. Read AGENTS, PLAN §1–§15,
latest handoffs and the approved C4 decisions. One agent, sequential work, no
branches/worktrees/delegation or repeated external research.

Added planned third-party service (external), analytics store / warehouse (database)
and serverless function (worker) families with every specified option. The planned
web application adds audience and kind, retaining its existing rendering/access
settings. All use the existing schema-driven inspector, P39 descriptions/technology,
family colors/icons, external styling, database cylinders and role-based boundaries.
Library search now includes option labels/choices; category/Implemented filters still
combine with search. A small screenshot-driven adjustment gives family/status badges
space to wrap in the shared planned inspector. CATALOG.md documents the new boundaries,
web options and reusable links; existing architecture examples were not changed.

Verification and twelve inspected captures are in [P41 evidence](evidence/p41/README.md):

- Final **`pnpm work run browser-preview`** command lists nine suites: **32 tests
  passed**, Playwright **27.5s** / profile **29.3s**, no retries, strict diagnostics,
  unchanged fingerprints; `2026-10-31T23-17-54-248Z-browser-preview-bc7eb566`.
- New mouse workflows place all three containers and the planned web application
  from option search/category filters, configure new fields/description/technology,
  Cancel without mutation, Save as one revision, undo/redo and reload. Family icons,
  external stereotype and warehouse cylinder are asserted. Axe passes on each desktop
  options surface and 390px dark diagram. Existing examples, C1/C3 editing/navigation,
  relationships, placement and scripted chat pass.
- **`pnpm work run check` → `pnpm check` passed**, **43.8s**, unchanged fingerprints;
  `2026-10-31T23-18-29-723Z-check-62688d59`. All workspace/script typechecks passed;
  **694 tests / 105 files**, Vitest **35.59s**; Biome **711 files**, **580 warnings /
  75 infos / no errors**. Schema tests cover every choice, invalid types/ranges/text
  lengths, planned C2 projections/generation blocking and unchanged legacy web config
  serialization. Generator golden/ownership checks pass without fixture edits.
- Opened all twelve final screenshots: each block's C2 and options at **1440 × 900
  light**, plus C2 at **390 × 844 dark**. Options scroll with fixed Save/Cancel.
  Focused unit/typecheck/browser runs and earlier full gates also passed; logs remain.
  Final gates ran sequentially after the badge-spacing adjustment, with no increased
  timeout/retry policy or suppressed diagnostics. `git diff --check` and documentation
  links checked before commit.

No runtime/template/recipe/generator implementation/output, dependency/lockfile,
golden or live QRWTY edits. New boundaries are planned and continue to block generation;
no implementation, capacity or latency is claimed. No material deviation from P41;
free-text technology already existed in P39 and was reused. Only planning/evidence/
handoff documents and screenshot copies changed after final gates. Removed **20**
exact-name/session-time projects left by existing suites and **38** session-created
E2E settings/output directories. New tests delete their own projects; none created
this session remain. Retained pre-existing data/logs/shared Postgres; existing health
on 4310 remains OK.

Next: **P42**, planned SaaS C3 responsibilities and client components, with the
recorded host-role filtering and default-off technical-components decision. Example
refresh remains P43. Continue the current-branch, one-agent, scoped-local-commit policy;
no runtime expansion or live adoption.

## 2026-10-31 — P42: SaaS responsibilities and client components

Completed [P42](build-plan-c4-saas.md#p42--c3-catalog-saas-responsibilities-and-client-components)
in the existing `main` checkout, starting clean at `1e8ea1e`. Followed AGENTS,
PLAN §15, the latest handoffs and the approved C4 decisions. One agent, sequential
work, no branches, worktrees, delegation or repeated external research.

Added all ten planned service/worker families: Integration adapter, Notifications,
Billing & plans, Organizations & members, Developer API & webhooks, Reports &
exports, Search & indexing, Scheduled jobs, Event handlers and Audit log. Added
four frontend families: Screen group / feature area, Client session & access,
API facade, Local state & offline sync. Each has bounded design options and the
existing workload targets. The library/type picker and semantic validation share
role compatibility for planned and registered hosts; old backend families still
fit services/workers. Web, mobile and desktop clients share frontend families.

Optional component technology (trimmed, ≤ 120 characters) edits through the same
Save/Cancel dialog and renders on C3 cards. Component stereotypes, client family
colors/icons and small card-spacing/truncation changes keep tags/status readable.
Connection-use choices show existing verb labels; inherited relationship labels,
protocols and interaction styles remain unchanged. Existing component relationship
editing remains available. CATALOG.md records all families and reverse C1/C2 reuse.

Implemented approved D9 with the default-off **Show technical components** checkbox
in Editor actions. It reveals HTTP resource boundaries and typed API adapters.
Filtering affects the displayed projection only: members, resources, operations,
explicit uses and the full evidence projection remain intact. Hidden adapters'
edges and now-unconnected neighbours are omitted; no replacement calls are inferred.
The toggle changes neither semantic revision nor board layout and resets on reload.
C1 remains free of technology tags.

Verification and all captures are in [P42 evidence](evidence/p42/README.md):

- Final **`pnpm work run browser-preview`** command lists eleven suites: **51 tests
  passed**, Playwright **44.2s** / profile **46.0s**, no retries, strict diagnostics,
  unchanged fingerprints; `2026-10-31T23-47-55-860Z-browser-preview-393997fa`.
- All fourteen new families are added from role-filtered search by mouse, configured,
  linked to a container with a verb/protocol label, canceled without mutation, saved
  as one revision, undone/redone and reloaded. Axe passes for every options surface
  and desktop/narrow diagram. The QR case compares all **16** displayed operations
  against the saved API preview with no duplicates, exercises both technical node
  types and checks filtering on the implemented frontend. Existing C1/C2/C3, declared
  relationships, examples, pins, retained conflicts, placement, resource configuration,
  API reference and scripted chat journeys pass.
- **`pnpm work run check` → `pnpm check` passed**, **44.2s**, unchanged fingerprints;
  `2026-10-31T23-48-52-649Z-check-4e694d2d`. All workspace/script typechecks passed;
  **726 tests / 106 files**, Vitest **36.99s**; Biome **713 files**, **596 warnings /
  75 infos / no errors**. New tests cover every option's type/choices/bounds, role
  filtering/atomic rejection, planning-only generation blocking, technology bounds
  and legacy serialization. Generator tests retain operation membership and explicit
  edges across visibility modes and compare all generated artifacts/wiring/ownership
  after technology edits except the existing lossless input snapshot. Golden fixtures
  are unchanged. Focused unit tests (55) and typechecking also passed.
- Reviewed all **44 final captures** in contact sheets and opened representative API,
  client, mobile, QR and options captures at full size: **1440 × 900 light**, **390 ×
  844 dark**. Options retain scrollable fields and fixed actions. QR narrow views remain
  fitted overviews with mouse zoom/selection for details. `git diff --check` and local
  documentation targets checked before commit.
- Interim browser logs retain the corrected open-dropdown footer obstruction, Mantine
  checkbox-menu role and description truncation. A full interim run passed 50/51;
  the existing context test reloaded before Redo finished, so it now waits for the
  saved architecture before reload. The first blocked browser run was interrupted
  after finding its shared cause. No timeout/retry increase or diagnostic suppression.

No runtime/template/recipe/generator implementation/output, dependency/lockfile,
golden or live QRWTY edits. New families remain planned and block generation.
No material scope deviation; reused existing dialogs and registered role metadata.
Only planning/evidence/handoff documentation and screenshot copies changed after
final gates. Removed **32** exact-name/session-time E2E projects (including interrupted
new cases) and **70** session-created temporary settings/output directories. No browser
session projects remain. Retained pre-existing data/logs/shared Postgres; existing
Jeeves health on 4310 remains OK.

Next: **P43**, QRWTY SaaS target architecture example and existing example refresh.
Current examples are unchanged. Page-flow routing, generated component behavior and
chat-library awareness remain separate. Continue the current-branch, one-agent,
scoped-local-commit policy; no runtime expansion or live adoption is implied.

## 2026-10-31 — P43: QRWTY target architecture and example refresh

Completed [P43](build-plan-c4-saas.md#p43--qrwty-target-architecture-example-and-example-refresh)
on the existing `main` checkout, starting clean at `39f86cd`. Read AGENTS, PLAN §15,
the latest handoffs and approved C4 decisions. One agent, sequential work, no branches,
worktrees, delegation or repeated external research.

Added **QRWTY target architecture** as a separate editable library example: fourteen
planned C2 blocks, the six requested C1 participants and nineteen authored responsibilities
across API (8), redirect (2), worker (3), owner web app (5) and admin console (1). Teams,
billing, developer access, CDN, analytical storage and e-mail/payment providers are
explicit planning boundaries. The destination is followed by the visitor browser;
there is no redirect-service fetch. The three existing studies now have descriptions,
technology, verb/protocol labels, identity, billing, e-mail, CDN and observability,
within thirteen/fourteen/fifteen blocks. Community includes subscription delivery;
Social includes mobile API/offline responsibilities. Miniatures derive their actual
nodes/edges from each composition. CATALOG.md and the [target study](examples/qrwty-target.md)
record reusable boundaries and proposed choices.

A small optional external context-to-block binding avoids duplicate providers at C2,
with semantic validation, Save/Cancel, undo and reload on the existing inspector. It
reuses directed connections by identity, survives renames and retains context when a
block is removed. Corrected incoming declared C3 uses for queue/provider delivery.
Desktop fitting retains C4 detail; C3 data neighbours are cylinders; text uses whole
lines and narrow title growth is bounded. C2 labels can use full fitted bounds and
the lower zoom floor fits larger narrow studies. C1/C3 camera fitting now includes
labels and routed bends through a presentation-only extent. These supporting changes
complete the example checklist without generating behavior or persisting derived geometry.

Verification and all **53 inspected captures** are in [P43 evidence](evidence/p43/README.md):

- Final **`pnpm work run browser-preview`** command there lists eleven suites:
  **50 tests passed**, Playwright **56.3s** / profile **58.1s**, no retries, strict
  diagnostics, unchanged fingerprints; `2026-11-01T00-19-13-368Z-browser-preview-eb355ccc`.
  All four examples are created from the library by mouse, leaving their seed projects
  empty, and traverse C1/C2/every authored C3. New checks cover actual miniature counts,
  visible desktop notation, C3 data cylinders, fitted cards and relationship labels,
  no narrow page overflow, planned atomic creation and persistent editable options.
  Target team options cover Cancel/Save/undo/redo/reload; provider binding covers
  Cancel/Save/undo/reload. Every captured diagram passes axe. Existing technical
  projections, worker failure/retry, pins, retained conflicts, placement, operation
  uniqueness, drawing and scripted chat pass.
- **`pnpm work run check` → `pnpm check` passed**, **43.6s**, unchanged fingerprints;
  `2026-11-01T00-20-14-035Z-check-028cd425`. All workspace/script typechecks pass;
  **736 tests / 107 files**, Vitest **36.55s**; Biome **716 files**, **643 warnings /
  75 infos / no errors**. Tests cover complete bounded example metadata, planned
  generation blocking, independent copies, provider binding rejection/reuse/removal/
  renaming, incoming C3 direction and camera bounds beyond cards. Generator golden/
  ownership checks pass with no fixture edits. Focused unit/type checks also passed.
- Reviewed all 53 final captures in five contact sheets and representative target
  views at full size: **1440 × 900 light** and **390 × 844 dark**. Narrow views are
  fitted overviews; mouse zoom/selection opens details. `git diff --check` and local
  documentation links checked before commit. Only evidence/screenshot copies and
  this handoff changed after final gates.
- Interim evidence retains corrected catalog ID, C2 label crowding, hidden desktop
  detail, narrow edge-label clipping and partial text lines. The first full check
  received SIGTERM during unit execution after typechecking; the final run completed.
  Two old layout tests now explicitly enable P42's default-off technical nodes,
  preserving their full-projection assertions. A later run passed 49/50 and caught
  the existing placement test racing its first saved card and reusing its ID; it
  now waits for each visible card before the next gesture. No timeout/retry increase
  or diagnostic suppression; final gates ran sequentially.

No live QRWTY, template/runtime/recipe/generator implementation/output, dependency pin,
lockfile or golden edits. All example blocks remain planned and block generation.
Provider identity binding and the small rendering/camera corrections extend the
existing surfaces to meet P43's checklist; no new runtime behavior. Removed **50**
exact-name/session-time E2E projects and **132** session-created temporary E2E settings/
output directories. No session projects remain; retained pre-existing data/logs/shared
Postgres. Existing Jeeves health on 4310 remains OK.

Next: **P44**, design-assistant awareness of the completed planning library, followed
by P45 dynamic scenarios. No chat support, page routing or live adoption is implied.
Continue current-branch, one-agent, scoped local commits.

## 2026-10-31 — P44: design assistant knows the library

Completed [P44](build-plan-c4-saas.md#p44--design-assistant-knows-the-library) on the
existing `main` checkout, starting clean at `140f956`. Followed AGENTS, PLAN §15,
latest handoffs and the approved C4 decisions. One agent, sequential work, no
branches, worktrees or delegation.

Added planned-family discovery and detail tools backed by the existing C2/C3
catalog, including every field/choice/default, config schema and compatible host
roles. Per-turn context now retains planned identities, selected options,
description/technology, relationship metadata and complete C1/C3 architecture.
Prompt rules cover C4 levels, one-line descriptions, verb/protocol relationships,
bounded initial diagrams, host compatibility, external identity reuse, honest
planning availability and preservation when replacing architecture. Unknown IDs
and invalid options retain shared atomic validation and placeholder recovery.
The existing operations schema already supported the required metadata and
`setArchitecture`; no separate editing path or model migration was needed.
CATALOG.md documents assistant access; planning pointers advance to P45.

Verification and eight inspected captures are in [P44 evidence](evidence/p44/README.md):

- **`pnpm work run unit apps/server/src/chat/chat.test.ts apps/server/src/chat/context.test.ts apps/server/src/chat/tools.test.ts`**:
  **18 tests / 3 files passed**, Vitest **3.66s**, profile **4.1s**;
  `2026-11-01T00-27-09-788Z-unit-ef8330b1`. Catalog exposure, scope/host filtering,
  complete context, invented IDs/options/incompatible C3 rejection with no partial
  writes, honest fallback and the multi-batch bit.ly C1/C2/C3 turn at one revision
  with undo/redo/persistence and next-turn context all pass.
- **`pnpm work run browser-preview apps/web/e2e/chat-planning.spec.ts apps/web/e2e/chat.spec.ts`**:
  **6 tests passed**, Playwright **10.6s** / profile **12.8s**, no retries, strict
  diagnostics, unchanged fingerprints; `2026-11-01T00-29-10-612Z-browser-preview-64462c8b`.
  Mouse sends the brief, navigates all three C4 levels, undoes/redoes/reloads the
  whole turn, then configures a chat-created responsibility with Cancel/Save/
  undo/redo/reload. Axe passes on all captured views and the narrow options dialog.
  Existing runtime-template chat, subtype review, questions, uploads and settings pass.
- **`pnpm work run check` → `pnpm check` passed**, **42.2s**;
  `2026-11-01T00-29-23-534Z-check-34a16d0c`. All workspace/script typechecks pass;
  **742 tests / 108 files**, Vitest **34.04s**. Biome **718 files**, **645 warnings /
  75 infos / no errors**. Generator golden/ownership checks pass unchanged. The
  runner correctly flags changed fingerprints: only eight screenshot copies and
  sanitized real-provider JSON were added under `docs/evidence/p44` during the
  check. Code/tests/existing fixtures/planning docs were unchanged; evidence JSON
  was separately formatted/checked and final `pnpm lint` also passed on **719 files**, with **645 warnings / 75 infos / no errors**, covering the completed evidence.
- Real configured **Codex / provider default** smoke completed in **55.277s**, four
  model rounds, **94,657 input / 2,357 output tokens** reported. The isolated
  ChatService/API/PGlite study created three planned C2 containers, two C1 actors
  and four API responsibilities as **one revision / seven operations**, with only
  nine expected planning findings. All tool calls succeeded. One undo cleared the
  design and architecture; redo restored them. [Sanitized evidence](evidence/p44/real-provider.json)
  includes the exact brief/result. No real model ID is invented where the adapter
  does not report it. Provider credentials/settings and live projects were untouched.
- Opened all eight captures at **1440 × 900 light** / **390 × 844 dark**, including
  chat, C1/C2/C3 and editable component options. Narrow views remain fitted overviews
  with mouse zoom/inspection. `git diff --check` and local documentation links checked.

Interim logs retain a corrected finding-count expectation (planned edges also
produce findings) and a corrected browser assertion that now finds components by
stable ID after the existing editor reorders an edited item. No product change,
increased timeout/retry policy or suppressed diagnostics was required for either.
No material scope deviation. No runtime/template/recipe/generator implementation,
output, golden, dependency/lockfile or live QRWTY edits. Planned capabilities still
block generation; the provider sample makes no broad quality/capacity claim.
Removed twelve exact-ID session-created E2E projects and 129 session-created
settings/output directories; the new journey deletes its own project even on
failure. Retained pre-existing data/logs/shared Postgres; health on 4310 remains OK.

Next: **P45**, dynamic scenarios over existing relationships. C4 code views, page
flows, runtime expansion and live adoption remain separate. Continue the existing
current-branch, one-agent, scoped local commit policy.

## 2026-10-31 — P45: dynamic runtime scenarios

Completed [P45](build-plan-c4-saas.md#p45--dynamic-runtime-scenario-view-optional)
on the existing `main` checkout, starting clean at `9036f10`. Followed AGENTS,
PLAN §1–§15, latest handoffs and approved C4 decisions. One agent, sequential work;
no branches, worktrees or delegation.

Added optional `architecture.scenarios`: stable scenario/step identities, name,
C2 or one-container C3 scope, ordered existing-relationship references and short
step text. Shared validation rejects missing/out-of-scope references, missing
applications, duplicate identities and invalid/bounded content. Referenced wiring
cannot disappear until its scenario steps are updated/removed, first or in the
same atomic batch. Authored C3 storage uses and explicitly declared dependencies
share their existing projection resolver with scenario validation. Old documents
omit the new field without serialization changes.

The diagram/editor menu picks, adds and edits scenarios. Numbered edge badges
remain legible across zoom and list all reuse numbers; a scrollable step list sits
beside the diagram, below it on narrow screens. Mouse controls add/reorder/remove
steps with multiline text, fixed Save/Cancel and shared one-step history. Whole
scenario removal, undo/redo, reload and retained revision-conflict drafts work.
C1 has no overlay. QRWTY target seeds **Visitor follows a QR** and **Owner creates
a link**, including conditional cache-miss, asynchronous analytics and request/
response reuse. The browser follows the destination; no service fetch is implied.
CATALOG, the target study and planning pointers record completion of P39–P45.

Verification and seven inspected captures are in [P45 evidence](evidence/p45/README.md):

- **`pnpm work run unit packages/spec/src/scenarios.test.ts packages/spec/src/architecture-examples.test.ts packages/generator/src/architecture.test.ts`**:
  **23 tests / 3 files passed**, Vitest **2.52s**, profile **3.2s**;
  `2026-11-01T00-47-32-325Z-unit-94d8ef0e`. Covers compatibility, independent
  seeds, repeated references, bounds/identities, C3 scope, atomic removal,
  projected authored storage uses and byte-identical generated behavior/ownership.
- **`pnpm work run browser-preview apps/web/e2e/architecture-scenarios.spec.ts apps/web/e2e/architecture-examples.spec.ts apps/web/e2e/architecture-layout.spec.ts apps/web/e2e/architecture-authoring.spec.ts apps/web/e2e/draw.spec.ts apps/web/e2e/chat-planning.spec.ts`**:
  **15 passed**, Playwright **30.0s** / profile **32.0s**, no retries, strict
  diagnostics, unchanged fingerprints;
  `2026-11-01T00-48-09-862Z-browser-preview-d34a58c6`. Add/reorder/remove,
  Cancel/Save/undo/redo/reload, whole removal/undo, repeated numbers, C1 exclusion,
  C3 scope navigation/filtering, missing-wiring rejection, conflict retention,
  axe and narrow overflow checks pass. Existing all-example/C3 navigation,
  grouped operations, worker retry, camera continuity, drawing and planned chat pass.
- **`VITEST_MAX_WORKERS=4 pnpm work run check` → `pnpm check` passed**, **44.6s**,
  unchanged fingerprints; `2026-11-01T00-51-47-010Z-check-8a6fec64`.
  All workspace/script typechecks pass; **748 tests / 109 files**, Vitest **37.26s**.
  Biome: **724 files**, **677 warnings / 75 infos / no errors**. Generator
  golden/ownership checks pass with no fixture changes. The environment limits
  concurrency only; no test/assertion/timeout/retry was changed or skipped.
- Two default-concurrency full checks timed out the existing disk-backed server
  restart/undo test at its unchanged **5000ms** limit, each **747 passed / 1 failed**:
  `2026-11-01T00-49-35-459Z-check-183c982b` and
  `2026-11-01T00-50-36-035Z-check-c8dd5930`. Its unchanged suite separately passed
  **18 tests**, Vitest **6.46s**, profile **7.0s**;
  `2026-11-01T00-50-25-455Z-unit-163111f9`. Default-concurrency timeout sensitivity
  remains a known verification limitation; no unrelated runner/config change.
- Opened all seven final **1440 × 900 light / 390 × 844 dark** captures, including
  both QRWTY flows, an authored C3 flow and the narrow editor. Narrow diagrams
  remain fitted overviews with mouse zoom/inspection; the list scrolls separately.
  `git diff --check` and changed-document local links pass.

Interim failures caught a component-use cleanup missing from an atomic-removal
unit expectation, a narrow flex rule lost through the panel wrapper, exact test
labels omitting required asterisks and the unregistered expected conflict response.
All corrected; no diagnostic suppression or timeout/retry increases. Screenshot
review led to zoom-independent numbers and multiline step drafts.

No material scope deviation. Stable step IDs and shared authored-dependency
resolution support safe reordering and reference validation. Scenarios describe
order over authored relationships; hidden technical-only edges/C1 context arrows
are not separate references, and one C3 connection can project onto several
component arrows carrying the same step number. Selection is session-local;
scenario content persists. No runtime/template/recipe/generator implementation,
output/golden, dependency/lockfile or live QRWTY edits. Only the lossless design
snapshot records metadata; planning blocks still prevent generation.
Removed four exact-ID projects left by early timed-out browser runs and 48
session-created E2E settings/output directories. Final journeys delete their own
projects; no P45 scenario projects remain. Retained pre-existing data/logs/shared
Postgres; existing Jeeves health on 4310 remains OK.

The approved **P39–P45 sequence is complete**. No next package is specified.
Implementation/code graphs, deeper data/deployment authoring, runtime expansion,
page flows, developer testing and live adoption remain separately scoped work.
Continue the existing current-branch, one-agent, scoped local commit policy.

## 2026-10-31 — Business synthesis and C4 direction review (documentation)

Reviewed the qrwty business reports, selected supporting studies, current vendor offers,
official C4 guidance, post-P45 architecture schemas/examples, P43 screenshots and proposed
P46–P53 plan. Read-only live API inspection confirmed qrwty revision 17: three elements,
two connections, no architecture metadata. No saved design was changed.

Added [the direction review](reviews/c4-direction-review-2026-10-31.md), with corrections
to classification, messaging, tenancy, horizons, patterns and advice; a relationship-contract
proposal; and six qrwty scenarios as the design-to-implementation handoff gate. Added
[durable C4 guidance](c4-modeling.md) and required reading from AGENTS.md. CATALOG clarifies
logical boundaries and message channels without changing availability. Planning entry
points now flag P46–P53 for revision and defer generator filtering under the user's
C2/C3-first instruction. This review does not approve or implement those packages.

The concise business assessment is in the separately owned qrwty repository at
`business-analysis/decision-review.md`. It recommends a bounded hosted-product experiment
and distinguishes enterprise-capable architecture from an enterprise sales/support business.
Existing report reorganizations were preserved.

Verification:

- `VITEST_MAX_WORKERS=4 pnpm check` passed: all typechecks; **748 tests / 109 files**,
  Vitest **35.80s**. Biome checked 724 files with 677 existing warnings and no errors.
  Concurrency follows the limitation recorded in P45; no test/config changes.
- Local Markdown file links and whitespace checked; scoped `git diff --check` passed.
- Required qrwty commands passed: `pnpm install`, `pnpm typecheck`, `pnpm test`
  (**29 API + 15 frontend tests**) and `docker compose up --build --wait`.
  The Compose check rebuilt/started the existing application stack and left it healthy;
  no application source, generated-owned files or saved design were edited.
- No new UI/runtime code, dependencies, generated outputs or paid model calls.
  Existing screenshot evidence was inspected; no new browser journey is claimed.

Next: refine a bounded C2/C3 interface-and-relationship authoring package from the review,
then reusable patterns and readable qrwty views. Do not start the old P46–P53 sequence
unchanged or infer that the new planning contracts are already implemented.

## 2026-10-31 — Revised P46–P57 roadmap (planning only)

At the user's request, replaced the original P46–P53 proposal with the
[P46–P57 authoring specification](build-plan-c4-evolution.md). The earlier proposal is
retained in Git at `ee31075`; its unapproved D17–D30 questionnaire is superseded.
No implementation package was started.

The revised order establishes catalog semantics, interfaces and relationship policies
before focused views, composition and architecture advice. It replaces partial-generation
horizons/live uplift with separate baseline-linked planning targets and preserves generation
readiness. Deployment refers to logical identities. Four added packages cover scenarios and
client outcomes (P54), a user-defined local architecture library (P55), qrwty plus non-QR
reuse proof (P56), and a revision-bound implementation brief/SVG export (P57).

Every package has prerequisites, outcome, build scope, acceptance, code pointers and exclusions.
Shared rules cover incomplete work, exact contract references, generation/evidence separation,
mouse/history behavior, chat parity and focused verification. Review findings remain separate
from the existing `blocksGenerate` error gate. New runtime/templates, code generation,
provisioning and live qrwty changes remain outside the sequence.

Updated AGENTS, PLAN, improvements, catalog and modeling guidance to point to the replacement;
marked the earlier review as historical rationale and updated the completed P39–P45 plan's
follow-up links. Catalog/runtime availability is unchanged.

Verification: changed planning-document links and sequential P46–P57 IDs/delivery sections
passed; `git diff --check` passed. `VITEST_MAX_WORKERS=4 pnpm work run check` passed all
typechecks and **748 tests / 109 files**, Vitest **35.13s**, recorded under
`2026-11-01T02-19-40-117Z-check-6327078a`. No UI/runtime changes or new browser journeys;
no live designs/applications were changed by this planning task.

Next when execution is requested: **P46 only**, following the revised roadmap and C4 guide.
Proceed sequentially; planning this sequence does not execute or complete its packages.

## 2026-10-31 — P46: catalog semantics and independent system choices

Implemented P46 only. [Release evidence and five inspected captures](evidence/p46/README.md)
record the mouse/editor result. P47 interface/contract authoring is next.

Added optional architectural classification, responsibility ownership and operation metadata
separately from runtime host role. Effective defaults do not rewrite old documents; changing
classification alone does not infer ownership. C2 notation uses logical ownership and keeps
externally operated stores inside the system when appropriate. Infrastructure remains visible
with a placement-pending label and cannot bind as a C1 external provider. Owned collectors can
be represented as applications; metadata never grants new runtime/component compatibility.

System context now edits business tenancy, authorization intent, isolation and delivery
independently, with unspecified choices. C1 exposes tenant audience without technical isolation.
The legacy combined tenancy config remains unchanged and labeled legacy intent. Four planned
C3 families cover entitlements, abuse, domains and data lifecycle with bounded, undecided policy
defaults. Logical queue/channel help and the catalog distinguish infrastructure and internal
notification responsibility from outside providers. The old billing-provider ID/options are
retained under Payment provider preset; no genuinely equivalent schemas were merged.

Shared UI/chat schemas and operations preserve draft/Cancel/history/conflict behavior.
Added focused schema/operation/host-compatibility and chat checks plus generation equality
coverage. No runtime, recipe, dependency/lockfile, generated contract/golden or live design
change. Classification choices are authoring metadata; new component families still block
runtime generation. A read-only live check confirmed qrwty remains revision 17 with three
elements and no architecture; Jeeves health was OK.

Final verification (all final run fingerprints unchanged):

- `VITEST_MAX_WORKERS=4 pnpm work run check`: passed all typechecks and **758 tests / 110 files**;
  Vitest **47.61s**, profile **56.4s**; `2026-11-01T02-34-52-324Z-check-5278d4ea`.
  Biome checked 728 files: **687 warnings / 75 infos / no errors**.
- `pnpm work run browser-preview apps/web/e2e/architecture-choices.spec.ts apps/web/e2e/architecture-authoring.spec.ts apps/web/e2e/architecture-examples.spec.ts`:
  **9 passed**, Playwright **36.1s**, profile **39.2s**;
  `2026-11-01T02-34-53-515Z-browser-preview-3b3aaa12`.
- `pnpm work run browser-preview apps/web/e2e/container-notation.spec.ts apps/web/e2e/saas-containers.spec.ts`:
  **8 passed**, Playwright **11.6s**, profile **13.5s**;
  `2026-11-01T02-35-57-677Z-browser-preview-1bf7a3c2`.
- Repeated only the two P46 flows to archive final captures after the compatibility suite
  replaced test-results: **2 passed**, profile **9.6s**;
  `2026-11-01T02-37-07-117Z-browser-preview-6c460564`.
- Strict browser diagnostics, scoped expected conflicts, axe and narrow overflow checks pass.
  Local Markdown links and `git diff --check` pass; no golden fixtures changed.

Interim checks caught a new test's capitalization mismatch and invalid-input TypeScript typing;
fixed without retries, timeout increases or diagnostic suppression. Final source review also
separated external responsibility from infrastructure placement and kept ownership defaults
independent of classification. Earlier source-changing runs are not final evidence. Screenshot
review corrected summary wrapping/badge overlap and used a generic Application label for
non-API applications. Cleaned one exact-ID orphan from the timed-out fixture; no P46 test
projects remain. Existing shared Postgres and live project data were retained.

Updated catalog, roadmap/entry pointers and agent guidance. Stop after this package; P47 is
specified by the revised roadmap and requires its own implementation session/commit.

## 2026-10-31 — P47: reusable interface and contract authoring

Implemented P47 only. [Release evidence and five inspected captures](evidence/p47/README.md)
record exact-version authoring and source staleness. P48 relationship bindings and policies
are next; this package supplies no runtime ports/adapters or contract compilation.

Added optional project-local `architecture.contracts` and `architecture.interfaces` collections.
Definitions carry stable IDs, explicit versions, kind/name/description and bounded planned
operation input/output or event/dataset fields. Instances identify component, container or
external-system providers/consumers and reference exact definitions. Domain-specific interfaces
need no new catalog family. Names/descriptions preserve references; in-use shapes require a
new version and explicit instance updates. Unreferenced drafts remain editable. Required-but-
unbound uses and unresolved fields are saveable, separate design-review findings, outside the
existing generation gate. Duplicate/dangling identities and invalid ownership reject batches.
Component removal explains that its interfaces must be removed first.

Existing P38 REST operations use element/attachment/member identities, including generated
resource operations and sessions. Resource datasets and durable-event members reuse their
existing schemas. Read-only current source shapes and canonical saved source snapshots expose
staleness when a relevant source shape changes or disappears. The saved base revision records
authoring provenance; exact source equality, not semver inference or general schema matching,
determines whether the reference is current. A referenced source cannot be edited or silently
refreshed through this UI. Legacy REST/recipe protection and executable generation remain intact;
only the lossless design snapshot includes declarations.

Manage interfaces appears in C3, container and external-system inspection, with provided/
required summaries, Save/Cancel, history/reload and explicit consumer-update previews. A
conflicting dialog retains its original base snapshot and draft; another Save cannot overwrite
the concurrent revision. Chat discovery returns sources, reusable definitions and separate
review results through `getArchitectureContracts`; shared operations keep one undo step per
turn, including multi-tool source capture. No new provider calls are needed for verification.

Final verification (fingerprints unchanged during each recorded final run):

- `pnpm work run unit packages/spec/src/architecture-contracts.test.ts packages/generator/src/architecture.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts`:
  **40 passed / 4 files**, Vitest **4.39s**, profile **5.0s**;
  `2026-11-01T03-05-38-772Z-unit-46283bf6`.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **769 tests / 111 files**
  passed, Vitest **41.18s**, profile **52.2s**;
  `2026-11-01T03-05-57-218Z-check-c0b9716b`. Biome checked 733 files:
  **771 warnings / 75 infos / no errors**. Existing four-worker concurrency policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-contracts.spec.ts apps/web/e2e/api-contracts.spec.ts apps/web/e2e/architecture-authoring.spec.ts`:
  **10 passed**, Playwright **21.2s**, profile **24.0s**;
  `2026-11-01T03-05-57-218Z-browser-preview-c5d57e6d`.
  Strict browser diagnostics, scoped expected conflicts, axe and narrow overflow checks pass.
- Opened all five final desktop-light/narrow-dark captures, including the explicit subset
  update and scrolled payload. Protected text/required-field labels remain readable and
  Save/Cancel stay fixed while the body scrolls. Whitespace and changed-document links pass.

Interim checks found required-label test selectors, a non-searchable update control, a stale
base snapshot after conflict and the chat test's explicit tool-list expectation. Corrected the
selectors/control and conflict behavior, tightened orphan-component ownership, and updated the
expected tool list. No retries, timeout increases, diagnostic suppression, dependency/config
or golden changes. Earlier source-changing or failed runs are not final evidence. Screenshot
review improved protected field/label contrast and added a focused payload capture.

No material scope deviation. Updated catalog, roadmap/entry pointers and agent guidance.
No runtime/template, generated contract/output/golden, lockfile or live QRWTY edits. Removed
four exact-ID E2E projects left by early timed-out runs; final journeys remove their own
projects. Existing shared Postgres and other saved data were retained. Evidence images and
this final record were archived after the code checks. Stop after P47 and its local commit.

## 2026-10-31 — P48: relationship bindings and architecture policies

Implemented P48 only. [Release evidence and eight inspected captures](evidence/p48/README.md)
record the authoring result. P49 focused views and persistent layout are next.

Added optional architecture bindings, logical datasets and scoped objectives. Exact provided/
required interfaces bind to existing C2 connections or local C3 relationships, with optional
operation selection. Several bindings share a connection; component-owned cross-container
interfaces derive their C3 use through the same C2 ID without duplicated wiring. Endpoint
ownership/containment, duplicate IDs and dangling references reject an atomic batch. Renames
preserve references; removal requires explicit cleanup, including objectives that reference a
binding/dataset. Existing executable connection endpoints and generation behavior are retained.

Interaction roles, declared transport and business synchrony are independent. Applicable policy
groups record caller identity/tenant/network, timeout/failure, retry/idempotency, event delivery/
ordering/acknowledgement and freshness/invalidation. Unknown and omitted groups remain explicit;
private reachability never establishes identity. The legend retains the asynchronous dashed-line
convention and explains dependency/message direction separately from business/delivery policies.
The new bounded link-service fixture models application→cache and application→store fallback,
write invalidation, a signed billing callback with durable HTTP acceptance/idempotency, and a named
visit channel with bounded analytics loss. These declarations supply no runtime guarantees.

Logical data responsibilities reference exact data contracts, including existing resource sources,
with authoritative owners/store, readers/writers and tenant/retention/deletion/export policy.
Shared authority requires an explicit decision. Dataset/binding references protect in-use contract
shapes alongside interfaces; source shape and staleness still use P47's read-only identity model.
Objectives identify system/container/component/binding/dataset scope and value/unit/boundary/window.
Redirect response time, analytics lag and background completion are separate unverified targets.

Manage relationship contracts is available from C2 connections and scoped C3 relationships;
Data responsibilities and objectives is in Editor actions. Fixed Save/Cancel actions, one-step
history, reload continuity and conflict drafts use existing revisioned operations. A rejected
conflict retains its opening snapshot; another Save cannot overwrite the concurrent revision.
Long outcome, idempotency and measurement fields wrap. Chat discovery returns bindings, datasets,
objectives and the shared architecture review; edits use the same validator and remain one undo
step per turn. Review reports version/role/direction/tenant/delivery/access/unit conflicts and
incomplete work separately from generation findings. No change to blocksGenerate or NEEDS_TEMPLATE.

Final verification (fingerprints unchanged during each recorded run):

- `pnpm work run unit packages/spec/src/architecture-bindings.test.ts packages/spec/src/architecture-contracts.test.ts packages/generator/src/architecture.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts`:
  **55 passed / 5 files**, Vitest **4.38s**, profile **5.0s**;
  `2026-11-01T03-23-05-243Z-unit-531b0bfd`.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **784 tests / 112 files**
  passed, Vitest **42.98s**, profile **51.8s**;
  `2026-11-01T03-23-50-027Z-check-aa5e15e3`. Biome checked 739 files:
  **945 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-bindings.spec.ts apps/web/e2e/architecture-contracts.spec.ts apps/web/e2e/architecture-authoring.spec.ts`:
  **9 passed**, Playwright **20.3s**, profile **23.1s**;
  `2026-11-01T03-23-51-141Z-browser-preview-73e4c7c4`.
  Strict diagnostics, narrowly registered expected HTTP conflicts, axe and narrow overflow pass.
- Opened all eight final **1440 × 900 light / 390 × 844 dark** captures. Binding identities,
  signed callback identity, cache invalidation, delivery bounds, shared authority, review text and
  scoped objectives are readable. Fixed actions remain reachable while content scrolls.
- Generator tests compare all executable outputs, contracts, artifacts and element ownership,
  excluding only the intentionally lossless `jeeves/design.json` snapshot. No golden refresh.
  Changed-document local links (**97 targets**) and `git diff --check` pass. Read-only E2E database
  inspection found **zero** remaining projects named `P48 relationship policies`.

Interim checks caught a type-name collision with the existing view binding, indexed generic UI
narrowing/registry factory typing, a test that reused an already-invalid base, and two browser
selectors (a local relationship ID and an unscoped option). Corrected these without retries,
timeout increases, diagnostic suppression or configuration changes. Screenshot review prompted
wrapping idempotency/measurement fields; final review added explicit role/direction and unknown
failure-bound feedback. Earlier source-changing runs are not final evidence.

No material scope deviation. Updated catalog and roadmap/entry pointers for actual authoring
availability. No runtime/template/recipe/dependency/lockfile changes, generated contract/golden
changes, live qrwty design/application edits, paid model calls or new deployment/generation work.
Policies and objectives remain intent; exact identity/version matching supplies no inferred schema
compatibility, authorization, event execution or benchmark evidence. Existing shared Postgres and
live data were retained. Stop after P48; execute P49 only when requested, on the current branch
with the existing sequential one-agent, scoped local commit policy.

## 2026-10-31 — P49: focused views and stable layout

Implemented P49 only. [Release evidence and seven inspected captures](evidence/p49/README.md)
record the result. P50 contract-aware pattern composition is next, only when requested.

Named C2 views select a responsibility/flow and optionally its immediate dependencies (one hop).
New/Edit view has Save/Cancel and deletion; the editable whole-system board remains available.
Focused diagrams retain the system boundary and actor/external-system identities. A count/link
accounts for every hidden relationship and navigates back to its actual whole-system identity.
QRWTY defaults now expose compact management and analytics flows plus redirect dependencies.
These defaults live in the example's layout, without changing its semantic topology.

Optional `layout.architecture` entries store membership/filter, positions, direction and camera
by stable view/projection identity. Legacy layout documents remain lossless with no migration.
C1 and each container's C3 scope use the same storage. Positions survive rename/configuration,
evidence refresh and technical-component filtering. Architecture pruning removes deleted identities
while retaining board placements awaiting semantic operations. The board's positions/camera and
existing history remain intact. Camera changes persist during viewport movement so immediate scope
navigation cannot lose the last zoom; reload restores the same saved C2/C3 camera and positions.

Mouse drag handles, four nudge actions, Fit selected (box or relationship endpoints), Reset layout,
and separate Undo/Redo layout are available. Reset returns deterministic worker geometry. Layout
history is local to the session and never records semantic edits; saved views/geometry/cameras
survive reload. Editor actions exposes layout history even after deleting the active focus.
Existing inspectors edit the same C2 outer endpoints and C3 responsibilities, with no new wiring.
Contract-bearing labels show a concise interface-contract count; selection expands exact contract
names/versions at screen size. Directed manual routes reserve label space outside cards.

Final verification (unchanged fingerprints during each recorded run):

- `pnpm work run unit packages/spec/src/layout.test.ts apps/web/src/architecture/layout.test.ts apps/web/src/draw/store.test.ts packages/generator/src/architecture.test.ts packages/spec/src/architecture-examples.test.ts`:
  **43 passed / 5 files**, Vitest **7.59s**, profile **8.3s**;
  `2026-11-01T03-43-49-017Z-unit-f679ccf4`.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **790 tests / 113 files**
  passed, Vitest **36.41s**, profile **49.9s**;
  `2026-11-01T03-44-25-202Z-check-a3f0dcc7`. Biome checked **742 files**:
  **1017 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-layout.spec.ts apps/web/e2e/draw.spec.ts apps/web/e2e/architecture-authoring.spec.ts`:
  **10 passed**, Playwright **20.3s**, profile **22.2s**;
  `2026-11-01T03-44-19-597Z-browser-preview-4d50c22b`.
  Strict diagnostics, existing narrowly registered conflicts, axe and narrow overflow checks pass.
- Opened all seven final **1440 × 900 light / 390 × 844 dark** captures. Management, redirect
  selection, analytics, exact contract versions and narrow dialog/inspector text are readable.
  Narrow fitted diagrams remain overviews; dialog Save/Cancel stay fixed and reachable.
- The representative browser/spec fixture extends the actual **14-container** target with two
  independent stores to exercise the **15+** acceptance boundary. No live design or example
  topology was expanded to satisfy that count. Generator compatibility tests pass without a
  golden refresh. Changed-document local links (**103 targets**) and `git diff --check` pass.

Interim checks caught a missing test lookup method, outdated fixture counts, an unsupported
hover matcher and formatting; corrected before the final gates. Browser work found the system
frame intercepting labels after dragging was enabled, so scope/bounds nodes are explicitly passive.
Visual review reduced default flow membership, moved selected summaries clear of the chat handle,
fixed dark Save contrast and retained exact version text without an invented prefix. A repeated
navigation journey exposed end-of-zoom camera loss; viewport-change persistence fixes it. The taller
C2 bar could reposition the native palette source; Draw now verifies its actual hovered source and
uses an explicit source point before native drag/drop. No retries, timeout increases, diagnostic
suppression or runner configuration changes were used. Earlier runs are not final release evidence.

No material scope deviation. Updated catalog, target documentation and roadmap/entry pointers for
actual authoring availability. No runtime/template/recipe/dependency/lockfile changes, generated
contract/golden changes, paid model calls or live QRWTY design/application edits. Existing generation
validation and `NEEDS_TEMPLATE` remain unchanged. Layout history is session-local; this does not
certify arbitrary manually overlapping diagrams or supply runtime evidence. The existing shared
Postgres/live data were retained; the single P49 fixture left by an early timed-out test was removed
by its exact ID. Stop after P49; execute P50 only when requested, in this checkout and branch.

## 2026-10-31 — P50: contract-aware pattern composition

Implemented P50 only. [Release evidence and seven inspected captures](evidence/p50/README.md)
and the [fragment/reuse contract](architecture-patterns.md) record the result. P51 requirement-
based advice and recorded decisions are next, only when requested.

Added versioned declarative architecture fragments using the existing P47/P48 contracts,
interfaces, bindings, datasets, relationship policies and scenario schemas. Required host,
boundary and component roles, bounded configuration, invariants and extension points expand
through one pure preview function. Four patterns cover tenant workspace/access, billing and
entitlements, cached public lookup with source fallback/update/disable propagation, and
asynchronous delivery. Best-effort and transactional-outbox variants remain explicitly distinct.
Outbox declares an atomic domain/event writer, two datasets in the same store, retained intent,
delivery/progress responsibility and idempotent consumption. No queue/handler substitution,
runtime attachment, actual transaction or measured guarantee is inferred.

Library → Patterns previews additions, unfilled roles and compatible candidates. Unique hosts
resolve automatically; multiple APIs/stores need an explicit choice. These SQL-based built-ins
use a relational-store/Postgres hosting role; caches/channels cannot match authority storage.
Boundary/component reuse is conservative: explicit pinned role and ownership, same configured
tenant/channel/bounds, exact contract identity/version/shape, and intact current fragment
policies/guarantees. Names/families alone never establish compatibility. Existing C2 connections
can be selected explicitly for matching endpoints/protocol/interaction; bindings share that
identity. Fresh visit and billing channels remain distinct even if a later deployment shares
one broker. Reused host configuration, display customizations and added dependencies remain.

Apply sends one validated operation batch with fresh identities and pinned historical provenance.
Recorded provenance is immutable within an edit; expanded architecture stays editable. Saved
compositions expose their original requirements separately from current graph satisfaction.
Fixed Apply/Cancel, one-step undo/redo, reload and retained conflict drafts work by mouse.
Unfilled structural host choices block Apply visibly. Domain payloads/lifecycle choices stay
explicit separate design-review work; existing generation findings and NEEDS_TEMPLATE are intact.

Chat exposes list/describe/preview/apply using the same expansion and validator without another
approval flow for ordinary supplied/unambiguous choices. Multiple applications retain the saved
base revision in provenance and commit once per turn. Pattern batches refuse the chat service's
generic stale-operation replay path: a concurrent revision adds nothing and requires a fresh
preview. Scripted chat matches mouse expansion and preserves concurrent context customization.

Final verification (unchanged fingerprints during each recorded run):

- `pnpm work run unit packages/spec/src/architecture-patterns.test.ts packages/spec/src/architecture-bindings.test.ts packages/spec/src/architecture-contracts.test.ts packages/generator/src/architecture.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts`:
  **65 passed / 6 files**, Vitest **4.24s**, profile **4.8s**;
  `2026-11-01T04-14-07-641Z-unit-e037669d`.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **800 tests / 114 files**
  passed, Vitest **37.57s**, profile **45.6s**;
  `2026-11-01T04-15-32-832Z-check-cecb6c50`. Biome checked **748 files**:
  **1131 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-patterns.spec.ts apps/web/e2e/architecture-authoring.spec.ts apps/web/e2e/architecture-examples.spec.ts`:
  **9 passed**, Playwright **27.0s**, profile **28.9s**;
  `2026-11-01T04-14-37-414Z-browser-preview-4f9b5122`.
  Strict diagnostics, narrowly registered expected revision conflict, axe and narrow overflow pass.
- Opened all seven final **1440 × 900 light / 390 × 844 dark** captures: role/freshness preview,
  explicit compatible reuse, outbox guarantees, completed scoped delivery layout and narrow
  controls/requirements. Fixed actions remain reachable. Scoped C3 retains separate channels.
- Generator compatibility preserves executable files/artifacts/ownership; only the intentionally
  lossless design snapshot reflects provenance. Actual planned expansions still block Generate.
  Changed-document local links (**108 targets**) and `git diff --check` pass. Read-only E2E
  database inspection found **zero** remaining projects with either P50 fixture name.

Interim checks caught a spec-test dependency boundary, planned security enum/type issues, a
missing undo base revision and an unintended subtype-review property; fixed before final gates.
Browser/visual review fixed Apply/alert contrast, removed an inaccessible nested scroll area,
tightened SQL-store eligibility and waited for completed C3 geometry before capture. Source
review caught and fixed stale chat pattern replay, with a focused concurrent-edit regression.
No retries, timeout increases, diagnostic suppression, dependency/config changes or golden
refresh. Earlier source-changing or failed runs are not final evidence.

No material scope deviation. Current built-ins deliberately use SQL hosting and conservative
reuse of intact pinned fragments; arbitrary manual responsibility adoption and user-published
storage remain P55 work. Updated catalog, roadmap and entry/agent pointers for actual authoring
availability. No new runtime/template/recipe, generated contract/output/golden, dependency,
lockfile, live QRWTY design/application, paid model or provisioning changes. Existing shared
Postgres and live data were retained. Evidence archives and this append-only record follow the
checks. Stop after P50 and its local commit; execute P51 separately in this checkout/branch.

## 2026-11-01 — P51: architecture review findings and decisions

Implemented P51 only. [Release evidence and seven inspected captures](evidence/p51/README.md)
and the [review/decision contract](architecture-review.md) record the result. P52 linked
current/target workspaces are next, only when requested.

Added optional typed selected requirements for access, cache-aside, delivery and failure.
The shared review report groups those with the existing P47/P48 contract, identity/tenant,
dataset authority/access/lifecycle and objective checks. Every finding carries concern,
assumption, linked inputs, conflict/unresolved state and a relevant-input fingerprint.
The production architecture API returns review separately; generation findings and
blocksGenerate are unchanged. Selected contradictions remain saveable but prevent review
completion. Structural invalidity still rejects the whole operation, including dangling
review/decision links, with historical repair preserved.

Cache checks follow the application's source fallback and bounded change/disable propagation,
without a cache→store dependency. Source/cache representations can have separate explicit
contracts; each binding still checks its own exact version. Schedule/request workers need no
queue; declared external consumers can supply channel delivery. Synchronous search, personal
billing and async-send-then-response are valid. No warnings derive solely from counts, duplicate
families, visitor-facing services, private hosting or line style; no inferred SSO/SCIM requirement.

Architecture review in Editor actions/Findings has concern groups, relevant editor selection,
cache/delivery pattern previews and requirement editing. Decisions retain context, decision/reason,
consequence, status and linked identities. Accepted scoped tradeoffs remain visible; only matching
fingerprints and relevant links acknowledge them. Changes to relevant requirement/binding/contract/
source inputs reactivate findings; unrelated revision, layout and notes/context wording do not.
Conflicts cannot be acknowledged away. Explicit Unresolved decisions prevent completion.
Fixed Save/Cancel, semantic undo/redo, reload and retained invalid/conflicting drafts work by mouse.
Dirty review drafts require Save or Cancel before a separate editor/pattern navigation.

Chat's getArchitectureReview uses the same report, schemas and operation validator. Ordinary
supplied planning edits need no additional approval. Scripted chat matches mouse output, commits
one undo step and preserves history. Review-bearing snapshots refuse generic stale-operation
replay so a concurrent edit saves nothing and requires a new read of relevant inputs.

Final verification (fingerprints unchanged during each recorded run):

- `pnpm work run unit packages/spec/src/architecture-review.test.ts packages/spec/src/architecture-bindings.test.ts packages/spec/src/architecture-contracts.test.ts packages/generator/src/architecture.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts`:
  **85 passed / 6 files**, Vitest **9.16s**, profile **9.9s**;
  `2026-11-01T04-59-58-310Z-unit-1cb468e2`.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **825 tests / 115 files**
  passed, Vitest **36.53s**, profile **44.6s**;
  `2026-11-01T05-00-52-064Z-check-e72a087f`. Biome checked **755 files**:
  **1273 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-review.spec.ts apps/web/e2e/architecture-bindings.spec.ts apps/web/e2e/architecture-patterns.spec.ts`:
  **8 passed**, Playwright **20.6s**, profile **23.1s**;
  `2026-11-01T04-59-58-308Z-browser-preview-0a2dc5af`.
  Strict diagnostics, narrowly registered expected HTTP conflict, axe and narrow overflow pass.
- Opened all seven final **1440 × 900 light / 390 × 844 dark** captures. Assumptions,
  exact-version conflicts, expired acceptance, decision text and narrow requirement fields are
  readable; fixed actions remain reachable while content scrolls.
- Generator compatibility preserves executable outputs, contracts, artifacts and ownership;
  only the intentionally lossless design snapshot retains new review metadata. No golden refresh.
  Changed-document local links and `git diff --check` pass. E2E database inspection found
  **zero** remaining projects with any of the three P51 fixture names after exact-ID cleanup.

Interim verification caught an exact chat-tool-list assertion and a required-label selector.
Accessibility review caught new badge contrast and the linked policy editor's hover contrast;
corrected before final gates. Semantic review removed an overly strict source/cache-contract
identity assumption and added a separate-representation regression. One full-check run overlapped
focused/browser suites and timed out two existing five-second database tests (project restart
history and legacy usage migration). The unchanged standalone four-worker gate then passed.
No automatic retries, timeout increases, diagnostic suppression, runner/dependency changes or
golden refresh were used. Earlier source-changing/failed runs are not final evidence.

No material scope deviation. Review is calculated from the revision; selected requirements and
decisions persist as semantic metadata. Fingerprints are non-security change detectors, not
signatures. Declared cache fallback/propagation, failure outcomes and delivery responsibility do
not prove code execution, capacity or security. Existing example gaps remain visible; no example
was rewritten to force a zero-finding result. Updated catalog and roadmap/entry/agent pointers
for actual authoring availability. No new runtime/template/recipe, generated output/golden,
dependency, lockfile, paid model, provisioning or live QRWTY design/application changes. Shared
Postgres/live data were retained; the single P51 fixture left by the early timeout was removed
by its exact ID. Evidence archives and this append-only record follow the checks. Stop after
P51 and its scoped local commit; execute P52 separately in this checkout/branch when requested.

## 2026-11-01 — P52: linked current/target planning workspaces

Implemented P52 only, in `/home/ash/github/jeeves` on the existing `main` branch.
[Release evidence and seven inspected captures](evidence/p52/README.md) and the
[workspace/annotation contract](architecture-targets.md) describe the result. P53 deployment
planning is next, only when requested.

Create target from this design captures the source project/name/revision and immutable semantic
snapshot, preserving stable identities, exact template pins, configuration, starter provenance
and copied layout. The new project has separate design/layout history and no inherited output
folder, generation/run history, chat or verification passes. Source edits produce separately
labeled baseline drift; source deletion preserves the baseline. Source identity/revision/snapshot
are observed together, avoiding a torn read during deletion. No automatic baseline refresh occurs.

Creation locks the source and inserts the target project, revision zero and layout atomically.
The scoped planning path admits structurally valid incomplete documents with their real readiness
findings. Ordinary executable starter/recipe creation remains strict. Structural failure, stale
revision and an injected failure after project/revision insertion leave no orphan target. Origin
metadata lives outside semantic operations; PATCH cannot replace it. The additive nullable
`projects.target` migration has generated snapshot metadata and no source-project foreign key.

Protected recipe copies retain their binding/configuration and protected core validation;
removing/replacing the binding is refused. An explicit conceptual-replacement creation requires
a reason and retains original recipe/configuration/constraints in the immutable baseline while
omitting the active binding only in the new planning design. API/service boundaries refuse target
output assignment, generation and runs with PLANNING_WORKSPACE before filesystem access or
scheduling. Generator subset behavior, ownership locks and source applications are unchanged.

The planning editor offers Current baseline / Proposed target / Changes. Baseline and proposed
snapshots are separate read-only topology/reference views; the normal target remains editable
through C1/C2/C3. Identity-based additions/removals/changes include before/after values, exact
contract versions and separate source drift. Revision/layout alone and top-level collection order
add no semantic noise. Saved-design facts are distinct from deployment and verification evidence.

Suggest responsibility annotations previews editable actor and C3 responsibility drafts from
explicit session-auth/resource/extension bindings. Existing groups/memberships are preserved.
Each suggestion retains saved revision, exact binding references and its stated basis. Resource
and extension groups need human domain naming; operation names never prove business behavior.
Legacy session config can suggest a generic actor without inventing resource components. Fixed
Save/Cancel, retained invalid/conflicting drafts, semantic undo/redo and reload remain available.
Existing context/component editors show provenance and preserve it through later edits.

Chat uses the same creation schema/service and pure suggestion/operation validators, including
the actual saved project name. Target creation commits at turn completion separately from design
edits and returns a target link. Supplied ordinary planning actions need no extra approval. Stale
source creation saves nothing; sourced annotation snapshots refuse generic concurrent replay.
Mouse and scripted chat annotation results match and save as one undo step.

Final verification (unchanged fingerprints during each recorded run):

- `pnpm work run unit packages/spec/src/architecture-targets.test.ts apps/server/src/design/architecture-targets.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts packages/generator/src/architecture.test.ts`:
  **61 passed / 5 files**, Vitest **5.30s**, profile **5.9s**;
  `2026-11-01T05-35-38-699Z-unit-71ca9a0f`.
- `pnpm work run browser-preview apps/web/e2e/architecture-targets.spec.ts apps/web/e2e/architecture-review.spec.ts apps/web/e2e/architecture-authoring.spec.ts`:
  **9 passed**, Playwright **14.4s**, profile **16.6s**;
  `2026-11-01T05-35-38-698Z-browser-preview-3678ec06`.
  Strict diagnostics, the narrowly registered expected creation revision conflict, axe and narrow
  overflow checks pass. Test cleanup flushes layout before deleting the active fixture project.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **843 tests / 117 files**
  passed, Vitest **37.09s**, profile **45.0s**;
  `2026-11-01T05-36-11-174Z-check-87d68e18`. Biome checked **761 files**:
  **1303 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- Opened seven **1440 × 900 light / 390 × 844 dark** production captures. Topology, source drift,
  replacement consequences, actor/group edits and exact source references are readable; narrow
  form bodies scroll with fixed actions. Generator compatibility preserves executable files,
  contracts, artifacts and ownership; only the intentionally lossless snapshot retains provenance.
- Offline Drizzle generation matched the scoped SQL exactly; generated snapshot comparison adds
  only nullable `projects.target`. `pnpm --filter @jeeves/server exec drizzle-kit check --dialect postgresql --out ./drizzle`:
  **Everything's fine**. The new snapshot passes Biome. Migration metadata/evidence archives and
  this append-only record follow the full gate; no application code changed after it.
- Read-only E2E database inspection found **zero** projects with any of the six P52 fixture names.
  The four fixtures left by the initial test timeout were removed using their exact IDs.

Interim checks corrected required generation fixture fields, synchronous validation assertions,
legacy baseline normalization, optional raw operation input typing and mouse/chat name parity.
Browser work corrected modal theme-toggle ordering, asynchronous redo assertions and fixture
cleanup racing layout saves. Visual review simplified annotation fields into named groups and
kept source references readable. The migration tool required a relative temporary output path;
its generated SQL and snapshot were checked before inclusion. No retries, increased timeouts,
diagnostic suppression, dependency changes or golden refresh were used. Earlier failed or
source-changing runs are not final evidence.

No material scope deviation. Baseline comparison intentionally presents saved topology and full
semantic snapshots; deployment diagrams remain P53. Provenance records historical suggestion
inputs, not implementation evidence. No new runtime/template/recipe, generator filtering,
generated output/golden, dependency/lockfile, paid model call, provisioning, live qrwty design or
application changes. Shared Postgres/live data were retained. Stop after P52 and its scoped local
commit; execute P53 separately in this checkout/branch when requested.

Final documentation validation: all **40 changed-document local link targets** resolve and
`git diff --check` passes. The completed P52 scope is ready for its local commit.


## 2026-11-01 — P53: logical deployment planning

Implemented P53 only, in `/home/ash/github/jeeves` on the existing `main` branch.
[Evidence and seven inspected captures](evidence/p53/README.md) and the
[deployment model/editor contract](architecture-deployments.md) describe the result.
P54 scenarios/outcomes is next, only when requested.

Optional architecture.deployments records alternative hosted/private environments, nested
placement boundaries and infrastructure, technology/location, declared replicas, operation
ownership and responsibility. Instance groups reference existing C2 application/store identities;
managed stores remain logical stores. The diagram expands replicas without duplicating C2.
Two named logical channels can share broker infrastructure while retaining their own C2
identities/policies. External C2/C1 providers retain their outside boundary.

Logical interactions reference exact C2/context relationships and preserve their endpoints and
direction. Infrastructure-only wiring needs a distinct identity, purpose/protocol and an
infrastructure endpoint; it cannot define an application contract or executable connection.
Reviewed legacy mappings require eligible internal infrastructure, original identity and a reason;
source classification and relationships remain intact. Structural validation rejects missing or
cross-environment references, cycles, duplicate identities, invalid counts, repeated channel
placements and projected expansion beyond the documented bounds. Unknown technology/location
and empty alternatives remain saveable planning intent.

Editor actions → Deployment plans provides mouse insertion, selection, editing/removal, fixed
Save/Cancel, retained drafts, semantic undo/redo and reload. Saved diagrams share P49's drag/nudge,
direction, Fit/focus, Reset and independent layout history. Nested geometry and per-environment
positions/cameras persist separately from semantic revision; removed environments/replicas prune
obsolete layout. An object picker and full selected summary keep small/off-camera objects
reachable; a nested disclosure exposes responsibility, ownership and exact logical references.
Closing retains the session draft; Cancel discards it. A stale save retains edits for review.

Chat uses the same setArchitecture schema/operation validation. Scripted chat matches mouse
semantics, commits one undo step and refuses automatic replay over concurrent planning inputs.
No extra approval is required for ordinary supplied planning edits. Optional metadata needs no
migration and does not change old serialization or executable generation/ownership.

Final verification, with unchanged fingerprints throughout each recorded run:

- `pnpm work run browser-preview apps/web/e2e/architecture-deployments.spec.ts apps/web/e2e/local-deployment.spec.ts apps/web/e2e/architecture-layout.spec.ts`:
  **7 passed**, Playwright **15.9s**, profile **17.9s**;
  `2026-11-01T13-50-11-679Z-browser-preview-b1775df0`.
  Includes strict diagnostics, the exactly registered expected HTTP revision conflict, axe,
  narrow overflow, source C2 preservation, local P33 behavior and focused P49 layout regressions.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **864 tests / 118 files**
  passed, Vitest **39.42s**, profile **49.4s**;
  `2026-11-01T13-50-30-743Z-check-f2510684`. Biome checked **768 files**:
  **1415 warnings / 75 infos / no errors**. Existing four-worker policy retained.
  Includes 21 new tests for semantic, projection, layout, scripted chat and generation boundaries.
- Inspected seven **1440 × 900 light / 390 × 844 dark** production captures. Whole topology,
  selected replica, nested managed responsibilities, two channels, external provider, mapping,
  retained conflict draft and narrow fixed actions are visible. Object selection/focus provides
  detail beyond the zoomed overview; placement forms scroll.
- Generator compatibility keeps all executable files, contracts, artifacts and ownership unchanged;
  only its intentionally lossless design snapshot retains new deployment metadata. No golden refresh.
- Read-only E2E database inspection found **zero** projects with the P53/P33 fixture names after
  deleting four earlier timeout fixtures by their exact observed IDs. Shared/live data were retained.

Interim checks corrected required-label selectors, a duplicate import and a test-only jsdom
fixture URL. Visual/interaction review corrected saved-draft comparison after database JSON key
ordering, save-button hover contrast and ambiguous close labels, and added the object picker.
The P33 regression needed its existing hidden technical components explicitly enabled and an
inspection snapshot taken after P49 layout persistence. Its generic network-idle wait could stall
under the combined suite; it now checks the actual saved camera at the CSS transform's six-decimal
precision. These are test adaptations to the current editor; LocalDeployment/local-deployment
runtime code is unchanged. No automatic retries, increased timeouts, suppressed diagnostics,
dependency changes or golden updates were used. Earlier failed runs are not final evidence.

No material scope deviation. Environment placement is declared design intent, never measured
resilience or provisioning. Updated catalog and roadmap/agent/entry pointers for actual authoring
availability. No new runtime/template/recipe, generated output, lockfile, paid model call, deployment
resources, generation subset, live qrwty design or application changes. Evidence archives and this
append-only record follow the required checks; no application code changed after the final gate.
Stop after P53 and its scoped local commit; execute P54 separately in this checkout/branch when requested.

Final documentation validation: all **47 changed-document local link targets** resolve, earlier
handoff bytes are preserved, and `git diff --check` passes. P53 is ready for its local commit.

## 2026-11-01 — P54: scenarios, outcomes and client journeys

Implemented P54 only in `/home/ash/github/jeeves` on the existing `main` branch.
[Evidence and eight inspected captures](evidence/p54/README.md) and the
[scenario model/editor contract](architecture-scenarios.md) describe the result.
P55's user-defined reusable architecture library is next, only when requested.

Extended P45 scenarios losslessly with context actor/start condition, bounded main and named
alternative/failure paths, branch points, expected outcomes/invariants and requirement/decision
links. Steps reference existing authored context/C2/C3 relationships and exact P48 bindings.
Request/response/continuation phases preserve static dependency direction; asynchronous work
followed by a response is valid. Context references touch the system and C3 entry/exit references
bind to its scoped application. Every path participates in structural/reference validation.
Duplicate local identities, missing/cross-scope wiring, incompatible bindings, outcome links and
client coupling errors reject the whole operation. Rename retains identities; referenced removal
requires dependent edits in the same batch. New alternative path IDs reserve main, while existing
P45 steps named main stay valid. Missing new fields remain saveable, explicitly incomplete intent.

Client states reference screen-group responsibilities participating through a binding interface
and a planned operation or authoritative REST-operation source. Loading/success/denied/failed
states stay product journey intent. The client component inspector lists these expectations.
The new separate scenario fixture covers redirect cache hit/miss/source fallback, visit-channel
failure and bounded analytics degradation, duplicate billing acknowledgement, and owner success
or denial. The original P45/QRWTY examples are unchanged.

Expectation review has Incomplete / Needs review / Reviewed / Stale states. An explicit authored
review records a deterministic non-security fingerprint of scenario intent and relevant actors,
relationships, bindings/interfaces, exact contracts and live sources, client definitions and linked
requirements/decisions. Related requirement bindings and decision-linked bindings/contracts are
included. Relevant edits expire review; unrelated revision/layout/notes/contracts do not. These
are authored acceptance expectations, never test results. Expectation freshness stays separate
from generation findings and P51 requirement-review completion.

Mouse editing adds/removes/reorders main and alternative steps, chooses outcome links and client
states, and records review. Fixed Save/Cancel and bounded visible errors remain reachable while
forms scroll. Invalid branches and revision conflicts retain drafts. Saves are one semantic undo
step, support redo and reload. Chat uses the same schemas/validators, reports scenario fingerprints
through getArchitectureReview and refuses stale scenario-bearing snapshot replay. Scenario-only
scripted concurrency excludes review metadata to prove this guard independently. Existing pattern,
review and deployment conflict handling retains its priority. Ordinary supplied planning edits need
no extra approval; chat records expectation agreement only when explicitly requested.

Final verification (unchanged Git fingerprints during each recorded run):

- `pnpm work run unit packages/spec/src/scenarios.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts packages/generator/src/architecture.test.ts`:
  **82 tests / 4 files**, Vitest **5.50s**, profile **6.0s**;
  `2026-11-01T14-33-15-277Z-unit-a80f4c41`.
- `pnpm work run browser-preview apps/web/e2e/architecture-scenarios.spec.ts apps/web/e2e/architecture-authoring.spec.ts`:
  **7 passed**, Playwright **15.3s**, profile **17.1s**;
  `2026-11-01T14-32-28-776Z-browser-preview-e890cdb5`.
  Production assets, strict diagnostics with exactly registered expected HTTP revision conflicts,
  axe, narrow overflow, P45 regressions, C3 authoring and client inspector all pass.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **889 tests / 118 files**
  passed, Vitest **37.62s**, profile **45.6s**;
  `2026-11-01T14-35-00-572Z-check-b8b2c5a1`. Biome checked **770 files**:
  **1590 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- Inspected eight **1440 × 900 desktop / 390 × 844 dark narrow** captures. Alternative conditions,
  client states, acceptance intent, stale review, fixed conflict messages and actions are readable.
  The whole C2 topology remains an overview; the focused client C3 and step panel expose detail.
- Generator compatibility preserves executable files/contracts, artifacts and ownership; only the
  intentionally lossless design snapshot gains scenario metadata. No golden refresh. Read-only
  E2E database inspection found **zero** projects with the P54/P45 scenario fixture names.

Interim checks corrected relative locator/required-label assumptions, hidden multi-select input
interaction, inherited save-button hover contrast and test-only optional architecture assertions.
The contract freshness browser check now creates an explicit v2 and migrates its interfaces/binding,
respecting P47's immutable referenced versions. Review caught legacy main-step compatibility and
source-backed operation coupling. Visual review compacted the narrow panel and moved bounded
conflict/reference errors beside fixed actions. No automatic retries, increased timeouts, diagnostic suppression,
dependency changes or golden updates were used. Earlier failed runs are not final evidence.

No material scope deviation. No workflow language, loops/scripts, executable simulation, UI/routing
generation, automatic tests, new runtime/template/recipe, generator filtering, paid model call,
provisioning, live qrwty adoption or application changes. No migrations are needed. Catalog and
roadmap/agent/entry pointers describe actual authoring availability only. Shared Postgres/live data
were retained. Evidence archives and this append-only record follow the final checks; no application
code changed afterward. Stop after P54 and its scoped local commit; execute P55 separately in this
checkout/branch when requested.

Final documentation validation: all **131 changed-document local link targets** resolve,
earlier handoff bytes are preserved, and `git diff --check` passes. P54 is ready for its local commit.

## 2026-11-01 — P55: prerequisite review, implementation pending

Reviewed the requested P55 package, PLAN §1–§15, C4 modeling guidance, the direction
review, and the latest handoff before changing code. This checkout ends at
`aa3d2d5` (`P51: add requirement-based architecture review and decisions`);
`git log -8 --oneline` confirms P52–P54 are absent. P55 explicitly depends on
P50 and P54 in `docs/build-plan-c4-evolution.md`. The current
`packages/spec/src/scenarios.ts` implements P45's ordered relationship steps;
P54's alternatives, outcomes and client journey references are not present.

PLAN §15 requires preceding acceptance checks to pass and says to stop rather
than guess when the plan blocks implementation. Asked the user whether to make
an explicit sequencing exception and implement P55 against the current model,
with its existing scenario schema, or complete P52–P54 first. No answer had
arrived when this entry was written. No implementation, dependency, catalog,
runtime, live project or generated output changed. Checks were limited to
read-only Git/source/document inspection; no test suite ran because no code
changed. This records an incomplete package, not release evidence; no completed
P55 commit was created. Resume with the user's scope decision in this checkout
and branch, without creating worktrees or delegating.


## 2026-11-01 — Restore the primary main checkout

The preceding P55 prerequisite note describes the stale detached worktree
`/home/ash/.codex/worktrees/8f48/jeeves`, not the primary repository. On the
user's request, inspected all registered worktrees, branches, local changes and
recent history. P52 (`197c568`), P53 (`2b8b6f2`) and P54 (`3fead3d`) are already
committed sequentially on `main` in `/home/ash/github/jeeves`. Their completed
handoffs and evidence are present there; no merge, cherry-pick or prerequisite
reimplementation is necessary.

Both Codex worktrees point to P51. The `a136` worktree is clean, with no ignored
or untracked files. The only change in `8f48` is the preceding note, preserved
verbatim above before removal. The user authorized consolidating local work on
`main` and leaving Codex worktrees. Updated AGENTS.md to require the primary
checkout and `main`, preserving the one-agent, sequential-package policy.
P55 remains the requested next package; its prerequisites are satisfied in this
checkout. Validation and worktree removal results follow below.

Both stale worktrees were removed with ordinary `git worktree remove`, without
force. `git worktree list` now reports only `/home/ash/github/jeeves` on `main`.
`VITEST_MAX_WORKERS=4 pnpm work run check` passed: all typechecks and **889 tests
/ 118 files**, Vitest **38.73s**; run
`2026-11-01T16-18-28-953Z-check-97126211`. No implementation or dependency changed.
`git diff --check` passes. Commit this recovery separately from P55.


## 2026-11-01 — P55: user-defined reusable architecture library

Implemented P55 only, after restoring the primary `/home/ash/github/jeeves` checkout
on `main` at the user's request. The preceding stale-worktree prerequisite note is resolved:
P52–P54 were already committed on this branch. Both detached Codex worktrees were removed
without force, their unique note was preserved, and recovery was committed separately as
`e7b62f4`. No new branches, worktrees or delegated agents were used.

[Evidence and six inspected captures](evidence/p55/README.md) and the
[local library contract](architecture-library.md) describe the implementation. Library → Saved
architecture templates extracts a selected C3 responsibility or C2 composition into P50's
versioned declarative format. Dependencies become named required hosts/components/context
roles and exact interfaces; external ownership is retained. The review exposes purpose,
compatible hosts, required roles, invariant declarations, finite options and extension points.
Source graph identities are replaced with fragment-local identities. Project/system identity,
private/unknown/free-text configuration, attachments/implementation notes, annotation provenance,
placement and run evidence do not enter the artifact. P54 actor/client/main/alternative paths,
linked requirements/decisions and exact binding references remap without authored review evidence.

The server-owned local catalog uses bounded schemas, SHA-256 canonical content and owner-only
atomic file replacement under JEEVES_HOME. Drafts have revision guards and can be deleted before
publication. Published versions are immutable; new versions are separate drafts. Retirement
removes new insertion while retaining published source records and consumer provenance. Service
and app restart tests retain the catalog. No database migration or new dependency is needed.

Mouse and chat share P50 expansion and the normal operation validator. Required responsibilities
check host/ownership/configuration, exact interface directions/versions/shapes and current policy
declarations. Missing roles, ambiguity and weaker guarantees remain visible. Independent instances
get fresh identities; required role bindings deliberately retain their contract identities, and
other shared definitions can be selected explicitly with every exact version/shape checked.
Multiple versions of one definition retain one identity. Optional libraryContentHash/libraryOptions
extend pinned historical pattern provenance. Instance customization does not edit its source;
v2 publication does not update v1 consumers. New planned architecture retains generation blocks.

Fixed insertion actions/errors, Save/Cancel, mouse selection, semantic undo/redo and reload work.
Empty composition-name drafts report validation without crashing; multiline invariants remain
editable. An asynchronous source recheck also verifies the project and local semantic revision
again before applying, so stale snapshots cannot overwrite a locally refreshed design. Scripted
chat uses exact source/version/content, commits one undoable edit and inherits pattern stale-replay
protection. Ordinary supplied planning choices require no extra approval.

Final verification, with unchanged Git fingerprints during each recorded run:

- `pnpm work run unit packages/spec/src/architecture-library.test.ts packages/spec/src/architecture-patterns.test.ts apps/server/src/architecture/architecture-library.test.ts apps/server/src/chat/tools.test.ts apps/server/src/chat/chat.test.ts packages/generator/src/architecture.test.ts`:
  **72 tests / 6 files**, Vitest **5.36s**, profile **5.9s**;
  `2026-11-01T16-48-46-257Z-unit-c700cdc6`.
- `pnpm work run browser-preview apps/web/e2e/architecture-library.spec.ts apps/web/e2e/architecture-patterns.spec.ts apps/web/e2e/architecture-scenarios.spec.ts`:
  **8 passed**, profile **18.8s**; `2026-11-01T16-49-40-080Z-browser-preview-bfbe696c`.
  Production assets, strict diagnostics, axe, narrow overflow, P50/P45/P54 regressions,
  semantic history, published versions/retirement and retained conflicts pass.
- `VITEST_MAX_WORKERS=4 pnpm work run check`: all typechecks and **900 tests / 120 files**
  passed, Vitest **36.08s**, profile **44.4s**;
  `2026-11-01T16-50-44-669Z-check-2ed683d4`. Biome checked **778 files**:
  **1725 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- Inspected all six final **1440 × 900 light / 390 × 844 dark** captures: component and
  multi-container drafts, required interface binding, independent expansion, published v2,
  and a retained conflict. Text wraps and fixed actions/errors remain reachable while content scrolls.
- Generator compatibility preserves executable files/contracts, artifacts and ownership;
  only its intentionally lossless design snapshot gains library provenance. No golden refresh.
  Changed-document local links (**204 targets**) and `git diff --check` pass; earlier handoff
  bytes are preserved. Database inspection found **zero** remaining P55 fixture projects.
  The source left by the first browser timeout was deleted by its exact observed ID/name.

Interim checks corrected a fake-provider argument, exact fixture binding/client references,
optional empty collection emission affecting an existing conflict guard, a hidden dropdown
covering Save, hover contrast, actual application theme switching and a strict alert selector.
Review added exact multi-version definition merging, finite-option provenance, explicit external
ownership and the asynchronous project/revision guard. No automatic retries, timeout increases,
diagnostic suppression, dependency/runner configuration changes or golden updates were used.
Earlier failed/source-changing runs are not final release evidence.

Deliberate portability limit: runtime-owned component members and source-backed contracts are
refused with instructions to supply explicit portable planned responsibilities/contracts. Copying
those project-owned source shapes could include private runtime configuration or falsely infer
portable equivalence. Unknown runtime families/deployment infrastructure likewise need an explicit
planned boundary. Extraction preserves portable planned selections and every required reference;
it never silently removes unsupported executable behavior to make a template appear reusable.
The catalog assumes one local server process. Hashes identify content, not execution or security.

No runtime/template/recipe implementation, generator filtering, code upload/marketplace, automatic
upgrade/dependency resolution, lockfile change, paid model call, provisioning or live QRWTY
application/design edits. Shared Postgres/live data were retained. Catalog, roadmap and entry/agent
pointers describe actual architecture-only availability. Stop after P55 and its scoped local
commit on `main`; P56's combined QRWTY/non-QR proof is next only when requested. Continue in the
primary checkout without additional worktrees or branches.

## 2026-11-01 — P56: QRWTY architecture proof and small Inventory reuse study

Implemented P56 only in the primary `/home/ash/github/jeeves` checkout on `main`,
starting at P55 (`68633de`). No branches, worktrees or delegated agents were used.
[Evidence and ten inspected captures](evidence/p56/README.md), the refreshed
[QRWTY study](examples/qrwty-target.md) and [Inventory study](examples/inventory-architecture.md)
explain the delivered model. P57's implementation brief/export is next only when requested.

New QRWTY targets compose four initial hosts through pinned tenant-access, asynchronous
visit-delivery, billing/entitlements and cached-lookup patterns, then specialize product intent.
The thirteen logical blocks keep payment/e-mail/DNS/certificate/integration boundaries external;
relational analytics is the baseline, with analytical storage/private delivery optional growth
choices. Hosted placement identifies application/data operation, broker-hosted named channels
and TLS responsibility without provisioning or inventing production region/replica capacity.
Existing saved targets are not migrated; original P43/P45 examples remain historical fixtures
for lossless authoring, classification and focused-layout regression checks.

C3 separates stable printed link identity/destination, encoded payloads, hosted page content and
artwork. Tenant/session/API-key checks, membership revocation, worker/export access, billing
adapter/policy/entitlements, custom-domain lifecycle, abuse, redacted audit, reporting and data
lifecycle have exact provided/required interfaces, data authority/access and linked decisions.
Client areas include Library/creation, Studio, reporting/exports, team/billing/domains and staff.
Source-backed runtime configuration and live projects never enter the examples.

Six scenario families use actual relationship and binding identities, with named alternatives
for cache/source/channel failure, API-key revocation, duplicate signed callback, domain transfer/
removal/abuse, deletion and recovery. Outcomes link policy requirements and consequential
choices. Browser follows returned Location; redirect never fetches destination. Visit delivery
requires no persisted acknowledgement and selects illustrative bounded loss; billing persists
and deduplicates before acknowledgement/effects. Authenticated monotonic mutations retain pending
propagation intent, bounded freshness/retry and fail-closed escalation. Downgrade preserves safe
printed links/content while new paid features/exports stop; abuse/domain revocation overrides grace.

Production workload, SLO, RPO/RTO, commercial retention and freshness choices remain explicitly
Unresolved with product-owner/operations ownership and blocked production scope. Numerical
policy values are marked illustrative examples. The recovery objective has no invented value.
Review retains this unresolved objective/decision; selected tenant/cache-failure/loss conflicts
cannot be waived by decision acceptance. Missing critical contracts reject operations atomically.
Scenario expectations start Needs review, relevant changes make authored review stale, and no
scenario/architecture review supplies runtime verification or a ready-for-production label.
Generic unresolved fragment payloads become explicit v2 definitions with reviewed consumer
migration; referenced v1 shapes are never rewritten. Provenance stays historical.

Library → Build a study step by step exposes concrete boundaries, exact contracts/policies,
decisions and outcomes before each validated atomic save. Fixed actions/errors, Cancel, mouse
selection, semantic undo/redo, save/reload and retained revision conflicts work. Shared stage
operations preserve unrelated context/scenarios and selected lifecycle choices. Ordinary
inspectors remain available for editing responsibilities and material decisions. Important C2
operations share communication arrows while retaining C3 ownership and exact binding identities.
Management, public redirect and analytics focus the same model; C3 mouse focus and interfaces
provide detail beyond its whole-host overview.

Chat lists/previews/applies bounded supplied study stages through the same operation builder and
validators, uses the saved base revision including pending edits and commits one undoable turn.
Scripted QRWTY/Inventory journeys exercise real persisted operations, open review and reload.
Existing pattern/snapshot concurrency guards refuse stale study replay and preserve concurrent
work. No paid model was called and no extra approval flow was introduced.

Inventory uses five logical blocks, the same exact tenant-access shape and transactional-outbox
stock intent: atomic state/event persistence, retained delivery progress, persisted acknowledgement,
retry and idempotent handling. It does not independently write stock before atomic commit.
The real local catalog also publishes portable tenant/delivery selections from QR's early
composition stages and reuses their exact version/content pins against explicit compatible
Inventory host/store interfaces. A copied best-effort informational channel stays separate
from durable stock work; names/families alone never establish compatibility.

Final verification, with unchanged source fingerprints during both recorded runs:

- `VITEST_MAX_WORKERS=4 pnpm work run check`: lint, every typecheck and **913 tests / 121 files**
  passed; Vitest **38.03s**, profile **48.1s**. Run
  `2026-11-01T17-41-14-339Z-check-410ef773`. Biome checked **782 files**:
  **1876 warnings / 75 infos / no errors**. Existing four-worker policy retained.
- `pnpm work run browser-preview apps/web/e2e/qrwty-design-readiness.spec.ts apps/web/e2e/architecture-examples.spec.ts apps/web/e2e/architecture-scenarios.spec.ts apps/web/e2e/chat-planning.spec.ts apps/web/e2e/architecture-library.spec.ts apps/web/e2e/architecture-patterns.spec.ts apps/web/e2e/architecture-layout.spec.ts`:
  **22 passed**, Playwright **48.8s**, profile **50.6s**. Run
  `2026-11-01T17-42-12-898Z-browser-preview-3a527be3`. Production assets, strict diagnostics,
  exactly registered HTTP revision conflicts, axe, narrow overflow, P43/P45/P49/P50/P54/P55
  regressions, version/retirement, semantic history and both input paths pass.
- Inspected all ten final captures: **1440 × 900 light / 390 × 844 dark**. Focused C2,
  selected C3/contract detail, scenario step list and fixed review/conflict actions are readable.
  Whole-system and management C3 diagrams remain overviews.
- Generator compatibility, executable files/contracts, artifacts and ownership pass in the
  required gate. No golden refresh, executable template or application behavior changed.
- E2E database inspection found **zero** P56 projects after removing three earlier failed-run
  leftovers by exact observed ID/name: `61553126-f9b2-4167-8eac-644a291a31a2` (Inventory),
  `18dee12e-286d-428d-a8e0-3f989fab3e6e` and `dac2e184-16da-4cc5-b6af-6ccba905c549` (QRWTY).
  The final browser run cleaned its fixtures normally; shared/live data were retained.
- The live QRWTY checkout retained HEAD `7e3ff68775c80a1b629b8c9099779dd2b8a57f63`,
  tracked-diff SHA-256 `7637c088bb713a3398231a3fa13334a99f934dffec3c3aa71b557af718a74d4e`
  and status SHA-256 `2c649534094db69634e301041f2152fa75538792d3890b9347094064ea7e1532`.
  Its existing business-analysis changes were preserved; no source application files were written.

Interim work corrected historical-target selector/required-label assumptions, exact stage/scope
references, interface-definition selection, hover contrast, completion-before-commit test races
and dialog/layout cleanup. One concurrent heavy unit/browser attempt produced resource-related
hook/screenshot/health failures; final gates ran sequentially without timeout increases, automatic
retries or diagnostic suppression. Earlier failed/source-changing runs are not final evidence.
The first complete 913-test gate also passed; final semantic typing/propagation refinements were
followed by the recorded repeated gate above.

No material scope deviation. Two existing boundaries remain explicit: semantic undo/redo does
not reconstruct focus membership removed by layout pruning, and fully coupled product selections
can exceed the local template's 20-role portability bound. Save bounded portable selections before
product-specific contract/scenario coupling or author a smaller explicit boundary; no references
are silently dropped. P56 adds no runtime/template/recipe implementation, generator filtering,
new infrastructure, dependency/lockfile, paid model call, provisioning, live adoption, implementation
tasks or P57 export. Catalog/roadmap/agent pointers describe architecture availability only.
Only evidence, documentation and this append-only handoff were written after the final gates.
Stop after P56 and its scoped local commit on `main`; continue with P57 only when requested.

Final documentation validation: all **180 changed-document local file targets** resolve,
earlier **517,012 handoff bytes** are preserved, and `git diff --check` passes.
P56 is complete and ready for its scoped local commit.

## 2026-11-01 — P57: revision-bound implementation review and portable handoff

Implemented P57 only in the primary `/home/ash/github/jeeves` checkout on `main`,
starting at P56 (`bd7608c`). No branches, worktrees or delegated agents were used.
[Usage/model contract](architecture-handoff.md) and [exact portable bundles, evidence and
nine inspected captures](evidence/p57/README.md) describe the completed package.
P46–P57 architecture authoring is complete; the runtime/template and generation phase
requires a separately scoped task.

Editor actions → Implementation handoff captures saved scope, actors, C2/C3 responsibilities,
relationships, exact contracts/interfaces/versions, bindings, data ownership/policies,
unverified objectives, scenarios/outcomes, decisions, deployment and pinned reusable provenance.
The real versioned JSON schema resolves source shapes and locally available architecture
manifests into portable sanitized definitions. Missing versions/content pins stay unavailable;
there is no remote lookup or invented replacement. Opaque runtime config, local output paths
and source example/default values are omitted explicitly. Known planning settings remain.

Coverage separates exact executable versions, validated recipe behavior, planned architecture,
custom obligations and external responsibility. Recorded checks retain project/revision/layer,
check IDs, statuses, omitted counts and separately hashed historical environments. Target
provenance retains source identity/revision without copying its private baseline or verification.
No clone inherits runtime passes. Review fingerprints include project identity, so same-named
copies cannot inherit ready approval.

Scope, ownership and explicit partial-scope approval use ordinary semantic Save/Cancel and
history. Structural problems, required-but-unbound interfaces, stale/unresolved contracts,
required behavior/policy gaps and missing obligation boundaries/expectations prevent readiness.
P51 exploration tradeoffs cannot waive those gaps. Capacity/commercial/recovery choices need
owners, blocked scope and explicit exclusions. Objectives remain unverified targets. Scenario
completeness/expectation-review states remain separate from runtime checks. Partial-scope
approval never activates partial generation. Semantic/project/scope changes stale approval;
revision counters, approval prose and layout/cameras do not. Captured dialogs retain their
revision and refuse stale approval. Read-only capture requires a base revision, checks it again
before returning, and sends no-store responses.

Deterministic Markdown/JSON share the captured revision/fingerprint. SVG captures the selected
C1, whole/focused C2, C3 or saved deployment view's actual geometry, title/legend, planned status
and selected scenario numbers. Source dashes remain distinct for declared C1 context and
asynchronous/streaming relationships. CSS world dimensions/subpixel normalization keep camera
changes out of the layout fingerprint. Deployment drafts must be saved/cancelled before export.

Final QRWTY has **33 contracts / 32 unique obligations**; Inventory has **14 / 18**. Obligations
link exact boundaries/bindings to scenario outcomes or pinned pattern invariants and acceptance
IDs, with explicit gaps. Neighboring containers repeated in C3 views are consolidated by stable
identity. Archives contain the exact three browser downloads without reformatting JSON. Their
approval is scripted fixture evidence, not user approval or production acceptance. All **55**
Markdown links resolve inside the bundles; JSON/Markdown round-trip byte-for-byte through the
real schema/serializers. Original manifest pins identify content before sanitization.

Final verification:

- `VITEST_MAX_WORKERS=4 pnpm work run check`: lint, all typechecks and **925 tests / 123 files**
  passed. Vitest **40.03s**, profile **51.5s**. Run
  `2026-11-01T18-25-27-368Z-check-93aea51d`. Biome checked **796 files**:
  **1942 warnings / 75 infos / no errors**. Existing four-worker unit policy retained.
- `pnpm work run browser-preview apps/web/e2e/architecture-handoff.spec.ts apps/web/e2e/qrwty-design-readiness.spec.ts apps/web/e2e/architecture-review.spec.ts apps/web/e2e/architecture-evidence.spec.ts apps/web/e2e/architecture-targets.spec.ts apps/web/e2e/architecture-deployments.spec.ts apps/web/e2e/architecture-library.spec.ts apps/web/e2e/architecture-layout.spec.ts apps/web/e2e/architecture-scenarios.spec.ts`:
  **26 passed**, Playwright **41.8s**, profile **43.6s**. Run
  `2026-11-01T18-28-32-980Z-browser-preview-3a8e0df2`.
- Both final runs have identical before/after source fingerprints (`sourceChanged: false`).
  Strict diagnostics, axe, narrow overflow, no-write/revision guards, repeat downloads,
  source staleness, recipe availability, critical-interface refusal, missing manifests,
  mouse undo/redo/reload and camera independence pass. Generator compatibility/ownership
  pass; no golden refresh or executable behavior changed.
- Inspected all nine final archived captures: **1440 × 900** desktop, **390 × 844** narrow dark,
  plus native focused C2/scenario, C1, C3 and deployment SVG renders. Focused views/review
  actions are readable; whole-system/C3/deployment retain overview geometry with vector zoom.
- Reparsed both archived JSON files with `architectureHandoffSchema`; exact JSON/Markdown
  serialization, archive members/links, unique obligation IDs, assigned exclusions and
  absence of inherited checks pass. Deterministic tar/gzip archives preserve original downloads.
- Final E2E inspection found **zero P57 projects**. Two initial selector-timeout fixtures were
  removed by exact observed ID/name: `63fc5b74-e636-4d66-8da7-c007addc95aa` (Inventory) and
  `3995c2ca-8c7e-4d3c-a003-d185fa92007c` (QRWTY). The P53 cleanup-timeout fixture
  `fb1572ff-aabe-40dc-93fc-9e8c8c8049d5` was likewise removed by exact ID/name.
  Shared/live data were retained.
- Live QRWTY retains HEAD `7e3ff68775c80a1b629b8c9099779dd2b8a57f63` and tracked-diff SHA-256
  `7637c088bb713a3398231a3fa13334a99f934dffec3c3aa71b557af718a74d4e`.
  Its status hash changed during the session; business-analysis work and an unrelated
  untracked drawing were retained. This package wrote no source application files. A new
  untracked `.docs/c4-flow.excalidraw` also appeared in Jeeves during a browser run; it was
  left untouched and excluded from the P57 commit.

Interim fixes covered schema alignment, selectors, contrast, asynchronous recapture, camera
rounding and duplicate neighboring obligations. An older evidence test captured layout before
P49's navigation save completed; it now captures the settled baseline immediately before
refresh. A later P53 regression timed out only in network-idle cleanup; the final complete
regression passed. An unrelated drawing changed that failed run's untracked fingerprint.
No diagnostic suppression, automatic retries, timeout increases, dependency/runner changes
or golden updates. Failed/source-changing/intermediate runs are not final evidence.

No material scope deviation. Documented portability limits remain explicit: omitted opaque
runtime config/source examples/defaults, unavailable definitions and overview-sized diagrams.
The handoff path makes no generation/task calls; the separate historical evidence regression
uses only its own disposable generated output. No runtime/template/recipe implementation,
generator filtering, generated lock rewrite, implementation orchestration, provisioning, paid
model call or live adoption. Only evidence/docs/handoff were written after final gates.
Stop after P57 and its scoped local commit on `main`; do not start the separate next phase.

Final document validation: **218 changed-document local file targets** resolve, all
**526,137 earlier handoff bytes** are preserved, and `git diff --check` passes.

## 2026-11-01 — UX: enterprise web application default project and project housekeeping

User-directed UX pass outside the P-package sequence, in the primary checkout on `main`.
Goal: a proper enterprise web application example at C1/C2/C3 as the default project, and
less clutter in the editor shell. No runtime, template, generation or unit-test work.

Built:

- `packages/spec/src/enterprise-web-example.ts`: the **Enterprise web application** study
  (`enterprise-web`), first entry in `architectureExamples`. Three people, three external
  systems, eleven planned C2 containers with labelled protocols, 19 C3 components with
  in-container relationships across the API, worker and both clients, two dynamic scenarios
  and two focused C2 views. The examples test now allows three external context systems for it.
- `apps/web/src/architecture/create-example.ts`: one shared "create project from example"
  path used by Library → Examples, the project chooser and the first-open default. A fresh
  installation (no projects) now opens on this study instead of an empty "Untitled design".
- Project chooser: new first, preselected **Architecture study** choice with a study select
  (all examples); four-column cards with a narrow-width fallback.
- Project menu: shows the eight most recent projects plus **All projects…**, a searchable
  browser (`ProjectBrowser.tsx`) with inline confirm-and-delete; `api.deleteProject` added
  over the existing DELETE route. Deleting the open project switches to the newest other one.
- Editor actions menu grouped under Board / Contracts and data / Review and handoff /
  Deployment / Dynamic scenarios, with Type colors last.
- Relationship labels drop the per-edge "Planned" badge when every modeled (non-context)
  relationship in a view is planned; node chips and view text still carry the status.
- ELK spacing widened (node 64, edge 32, between layers 72/40) for focused and C3 views.
- CATALOG.md C1 entry and starters/README pointer.

Checks: `vitest run packages/spec/src/architecture-examples.test.ts packages/spec/src/architecture.test.ts`
(11 passed), `pnpm --filter @jeeves/web --filter @jeeves/spec typecheck` (clean),
`biome check . --diagnostic-level=error` (no errors). The full `pnpm check` and E2E suites were
not run at the user's instruction (UX first, tests later). Live verification: the study was
created through the real API as project `dd45f916-e0ea-4152-aadf-bdbaaedc807e` ("Orders
platform") and inspected at C1, C2 (whole and focused), C3, the browser and the chooser.

Known issues / next:

- The live database holds 622 leftover E2E projects (E2E *, Restart check, axe, Shot/Shots).
  Bulk deletion was blocked by the agent's permission policy; delete them from All projects…
  or with a scripted DELETE by ID. Root cause (specs not cleaning up) is not fixed.
- The whole-system C2 view uses authored card positions with midpoint edge labels, so dense
  designs still overlap labels; focused views and C3 use ELK and read cleanly. Routing the
  whole-system view through ELK with saved overrides is the next UX step.
- Template-backed projects still show one C3 component per REST operation unless they declare
  components; the C4 guidance says components are responsibilities, not endpoints.

## 2026-11-01 — UX2: C2/C3 architecture studio, Streamly study and repository cleanup

User-directed improvement package on `main` in the primary checkout. The user requested
aggressive C2/C3 authoring and offering improvements, a high-traffic web-product study, and
cleanup of obsolete repository material. Their explicit instruction defers unit/E2E suite
execution and test maintenance, and keeps C4 implementation/runtime expansion out of scope.
No branches, worktrees or delegated agents were used.

Built:

- Whole-system C2 now uses the routed architecture canvas, as C1/focused C2/C3 already did.
  Variable-height application cards show their high-level responsibilities; each child opens
  the same identity in C3. Label space is reserved by layout. Selection, Fit diagram,
  Focus selection and Auto-arrange are directly available. Only deliberate position overrides
  are saved; automatically laid-out coordinates no longer become stale manual geometry.
- A searchable design explorer exposes boundaries, responsibilities and relationships.
  Visible Add/Connect tools replace the hidden placement workflow for architecture intent.
  C3 Connect dependency records its container relationship and owning component use in one
  undoable operation. URLs retain the architecture level, application and focused-view key.
  The freeform board/annotations and existing generation workflows remain secondary actions.
- The library separates C2 containers, C3 components, patterns, examples and runtime templates.
  C3 host choices enforce compatibility. Added request handling, data access/transactions,
  cache freshness, workflow orchestration, transactional event publishing and traffic admission.
  Workload and legacy tenancy options are disclosures. Deployment infrastructure and redundant
  provider presets no longer crowd ordinary container choices.
- Legacy template resources/REST extensions are grouped into capability responsibilities,
  with Define responsibility preserving their actual members. Individual interface operations
  remain inspectable. Technical adapters are optional, and queue/topic channels no longer
  receive misleading application-component scopes. Event definitions are grouped as event handling.
- C2 SVG export now includes the responsibilities visible inside application cards. The
  portable diagram schema accepts these optional child identities/names without changing
  semantic contracts. Selection emphasis retains text contrast. Desktop and narrow layouts
  expose the same authoring actions through toolbar and menu controls.
- Added the default **Streamly · video platform** study: a proposed YouTube-style product,
  not an assertion about YouTube's private systems. Six applications, seven stores/channels,
  three providers, 26 C3 responsibilities, 26 C2 connections, 22 local C3 relationships,
  51 v1 contracts, six focused views and four scenarios. Explicit outbox atomicity,
  duplicate-safe processing, cache/source authority, moderation/revocation bounds, data
  ownership and five unverified workload objectives make its tradeoffs inspectable.
  The enterprise orders study remains available. See [Streamly walkthrough](examples/streamly.md).
- Created the actual live project `a6eeb601-6efd-46e0-9444-f0edddad8d2e`,
  **Streamly · video platform**, revision 2. Start at
  `http://127.0.0.1:4300/?project=a6eeb601-6efd-46e0-9444-f0edddad8d2e&level=containers&view=focus-watch`.
  New-project creation uses the same tracked example source.

Cleanup:

- Removed the retired standalone editor comparison page and Excalidraw dev dependency,
  its obsolete browser spec, unused StarterGuide/inspector Rail/GenerateButton, associated
  styles, and the test that only imported the removed Rail. No replacement test scaffolding.
- Removed the superseded 982-line original plan copy and five unreferenced evidence PNGs
  (451,562 bytes). Retained linked historical evidence. Retired stale fresh-agent/next-package
  prompts in the P12/P35 documents, retaining historical pointers and Git recovery commands.
- Rewrote README and the catalog introduction around the current product; added a concise
  documentation index, studio guide, runtime-workflow reference and Streamly walkthrough.
  Catalog rows include the new C3 offerings. Historical handoff entries are unchanged.
- The live database had nine projects at session start, not the 632 in the earlier handoff.
  No 622-project purge was applicable. It now has ten: all nine original projects plus Streamly.
  Every temporary project created for this session's direct UI inspections was deleted by its
  exact ID. No original project was deleted or semantically edited.
- Pre-existing untracked `.docs/` drawings and both FieldOps fixture files were preserved and
  excluded from this commit. The removed package was used only by the retired comparison;
  existing user Excalidraw files remain untouched.

Validation (actual commands/results; no unit/E2E suites):

- `pnpm typecheck`: all workspaces plus scripts passed. After the last projection/CSS adjustment,
  `pnpm --filter @jeeves/spec --filter @jeeves/web typecheck` also passed.
- `pnpm --filter @jeeves/web build`: passed, final Vite build 797 ms. Existing large-chunk
  advisory remains; no bundling or runtime-generation expansion was attempted.
- Biome error-level check over all tracked source/config/HTML files plus the three new TS/TSX
  sources: **784 files, no errors**. `pnpm lint` / whole-repository Biome remains blocked solely
  by formatting in the pre-existing untracked `fixtures/designs/fieldops-architecture.json`.
  That unrelated fixture was not reformatted or staged. Existing repository warnings remain.
- Direct schema/projection validation through `pnpm --filter @jeeves/server exec tsx -e ...`:
  **16 containers, 26 components, 26 C2 / 22 C3 relationships, 51 contracts, six application
  scopes, six focused views, zero structural errors**. Expected NEEDS_TEMPLATE findings are
  retained; the study claims no runtime implementation or capacity verification.
- Temporary Playwright inspection scripts under `/tmp` used the live dev API/UI, with no
  persistent test code added. Add container → add two components → connect components → add
  store → connect dependency → Undo/Redo → reload produced two containers, two components,
  two relationships at revision 8 and **zero browser errors**.
- A disposable copy of a legacy QRWTY template design grouped all **eight** extension operations
  into an authored responsibility through Define responsibility; Undo/Redo/reload preserved
  those member bindings, with **zero browser errors**. Original QRWTY was not edited.
- Direct grip dragging saved exactly one manual override; reload retained it; Auto-arrange
  cleared it; Undo layout restored it. Semantic revision remained 1, with zero browser errors.
- Final desktop C2 child drill-down, focused C3 inspection, mobile C3 and mobile library were
  visually inspected. Axe WCAG 2A/2AA/2.1AA reported **zero violations** in all four states.
  At 390×844, document width remained 390 px; no horizontal overflow or browser errors.
- Actual Implementation handoff → Download SVG produced a **10,088-character** focused C2
  diagram including child responsibilities. Desktop C2/C3 and narrow captures were reviewed.
- Changed-document check: **116 local file targets resolve** in the authored documentation.
  `git diff --cached --check` passes for the package. The earlier **537,272 handoff bytes**
  are preserved as the prefix of this appended record.
- Concurrent edits to README appeared during final staging. The index contains
  only this package's earlier README rewrite; the user's newer text remains untouched
  in the working copy and outside the commit. Its unfinished image link/whitespace were not
  silently edited as part of validation.

Limits and next-work context: a dense whole-system view remains an overview; use focused
views, explorer selection or zoom for legibility. Existing authored layout overrides are kept
until Auto-arrange is chosen. Legacy test assertions have not been updated for new geometry,
labels, default examples or the queue/component distinction, per the user's instruction.
The Streamly workload figures and scenario outcomes are proposed design assumptions, not
measured traffic evidence. C4a/C4b, template expansion and production capacity validation remain
separate work. This package completes the requested authoring/cleanup pass; it does not restart
any completed P46–P57 sequence.

## 2026-11-01 — REPO1: include user drafts and configure GitHub diagram rendering

The user explicitly authorized committing all remaining work, including their README, drawings,
FieldOps fixtures and cleanup, and creating/pushing `ashfordhill/jeeves`. They selected **private**.
`gh auth status` confirmed the active `ashfordhill` account with repo/workflow access.
Created [ashfordhill/jeeves](https://github.com/ashfordhill/jeeves) as a private repository and
configured `origin`; existing local commit history is retained for publication on `main`.

- Included the user's README draft and all four `.docs/` assets. Kept their prose, fixed the
  diagram/catalog/Automation Illustrator links, trimmed trailing whitespace and added the final newline.
- Included both FieldOps architecture/layout fixtures. Biome formatted the architecture JSON;
  before/after parsed content is identical. Shared schemas accept 26 elements, 49 components
  and 26 layout items.
- Copied `.github/workflows/render-excalidraw.yml` from the local `automation-pitch` repository
  (GitHub `ashfordhill/automation-illustrator`). Retained the user's SVG renderer, pinned the
  existing checkout v4 / renderer v1 references to their observed commit SHAs, added manual
  dispatch and workflow-change triggers, limited automatic runs to main, and serialized runs.
  The bot stages only SVG output and restores source files before committing.
- `.docs/c4-flow.excalidraw` is an empty placeholder. The workflow skips empty files in its
  temporary checkout so the existing valid `docs/examples/qrwty.excalidraw` can still render.
  The original placeholder remains in Git. README displays the existing C4 PNG.

Checks: full `pnpm lint` passes (**797 files**, 1979 existing warnings / 75 infos / zero errors).
Workflow YAML, push/manual trigger declarations, embedded shell syntax, local README links,
FieldOps design/layout schemas and `git diff --check` pass. No application source changed;
the preceding UX2 typecheck/build/browser verification remains applicable. Unit/E2E suites
remain deferred per the user's instruction. No credential/config files are added.

## 2026-11-01 — REPO2: accessible titles for rendered Excalidraw SVGs

The first render bot commit (`b833f33`) introduced `docs/examples/qrwty.svg` without a
`title`, which fails Biome's SVG accessibility rule. Added its descriptive title and a
post-render workflow step that supplies missing/empty titles from each source filename.
Existing nonempty titles are preserved, and only corresponding rendered SVGs are touched.
This is a small prerequisite cleanup discovered during UX3 validation, committed separately.

Validation: workflow YAML parses; its extracted Python step compiles and was exercised in
an isolated temporary directory against missing, empty and existing titles. A second run is
byte-identical. `pnpm lint` passes (798 files; warnings remain, zero errors). No unit/E2E
suite or application runtime work. The workflow change is local and has not been pushed or
executed by GitHub Actions. Concurrent README edits and the in-progress UX3 files are excluded.

## 2026-11-01 — UX3: Mattermost reference architecture and visible deployment design

The user rejected Streamly's vague client components and requested a real application with
published diagrams as a test of Jeeves. They selected **Mattermost**. Read the GIF at
`.docs/mvp-flow.gif`, C4 guidance, official Mattermost application/HA diagrams, operator docs,
and selected source files. Runtime generation and unit/E2E suite maintenance remain deferred.

- Added the default **Mattermost · architecture reference** example through the normal project
  creation path. Seven C2 boundaries, twelve C3 responsibilities, ten C2 / eleven local C3
  relationships, three explicitly partial contracts, four directionally checked bindings,
  one dataset, three focused views and a messaging/reconnect scenario. C3 starts with the
  application server. Every component links to the inspected public source snapshot.
- Source provenance and translation limits are recorded in the model and
  [Mattermost walkthrough](examples/mattermost.md). C3 is our decomposition, not a claim that
  upstream supplied that exact drawing. The API array field is explicitly unresolved; no
  invented generic outcomes or complete-contract claims. Latency values remain undecided.
- Added AWS placement matching the selected published 5,000-user image and a separately
  labelled Kubernetes adaptation. Logical server/store identities are reused across instances.
  Load balancing, app/job hosting, writer/reader roles, S3, peer exchange and database replication
  are visible. Detailed controller/image/resource/autoscaling and recovery settings remain open.
- Added validated `replica` deployment interactions between separate instances of the same
  application/store. They cannot invent cross-application dependencies or duplicate logical
  queue/topic replicas. Existing logical and infrastructure interactions retain their semantics.
- Added visible **Deployment** access beside C1/C2/C3, a full-screen editor and placement choices
  for Kubernetes, pods, Docker, VMs, managed database, load balancing, Services and brokers.
- Added the reusable realtime-client C3 family with implementation/recovery choices. Component
  inspection exposes the selected implementation and clickable source/design decisions.
  Updated the catalog and current guidance. Existing projects, including Streamly, remain intact.
- Created live project `b78f8fa0-f0a1-4c0c-8aa8-554de5b3eb62`, revision 1:
  `http://127.0.0.1:4300/?project=b78f8fa0-f0a1-4c0c-8aa8-554de5b3eb62&level=containers&view=focus-messaging`.

Checks, without persistent test code or unit/E2E suites:

- `pnpm typecheck`: passed across all workspaces and scripts. Final web typecheck passed
  after adding component source inspection.
- `pnpm --filter @jeeves/web build`: passed; existing large-bundle advisory remains.
- `pnpm lint`: passed, 798 files, zero errors (1997 warnings / 75 infos). An older bot-rendered
  SVG accessibility failure was fixed separately in REPO2 before this handoff.
- Direct schema/architecture validation: zero structural findings; NEEDS_TEMPLATE remains the
  expected availability finding. All three C3 projections resolve. AWS has 10 visible objects /
  18 interactions; Kubernetes has 11 / 19; no dangling projected edges.
- Temporary validation rejects replica links across containers, self-placement links, missing
  elements, external endpoints and named channel replication without crashing.
- Direct live-browser inspection covered whole C2, server C3, both deployment views, source
  reference selection, placement preset/cancel, replica-link edit/save/reload and undo/redo.
  The edited disposable design reached revision 4. All temporary projects were deleted by exact ID.
- Axe WCAG 2A/2AA/2.1AA: zero violations for selected C3, desktop deployment and 390×844
  deployment. Narrow document width stays 390px; zero page errors. Screenshots reviewed under
  `/tmp`; no extra evidence-image clutter was added. Local links and scoped diff checks pass.

Limits: whole-system graphs still need zoom/focused views; nested payloads, richer workload
units, structured deployment policies and route-to-contract tracing remain design gaps. This
example is not a complete production or generation specification. No GitHub push was performed.
The user's concurrent README draft is preserved outside this commit. Their subsequent request
for an aggressive UI text/badge cleanup is the next package (UX4), not part of this completion.

## 2026-11-01 — UX4: remove repetitive UI copy and visual clutter

The user requested a UI/UX review followed by aggressive removal of unnecessary explanations,
chips and labels. Reviewed C2/C3, the explorer, selected-object inspectors, the library, project
creation and deployment in the browser. Kept architecture meaning, authoring actions and errors.

- Removed repeated Planned card badges, Component labels inside C3, duplicate level captions,
  explorer C2 chips/totals, option-count labels, runtime-template badges within their own tab,
  generic library introductions and project-creation marketing/boilerplate. The footer version
  number is gone; server health and the theme switch remain.
- Simplified C2 child responsibilities to clickable rows, and removed repeated in-process arrow
  subtitles and chip borders. Drag grips appear on hover/focus (always on touch). Retained names,
  responsibilities, useful technologies, protocols, exceptional binding warnings and all actions.
- Removed unreadable miniature example diagrams, their unused component and CSS. Example cards
  retain the distinguishing description and a concise Use example action.
- Component/source detail and availability remain available through selection and disclosure.
  Empty interface/contract sections now offer an action without repeating an empty-state sentence.
  Notes are collapsed; edit forms retain labels, validation and Save/Cancel behavior.
- Deployment now opens directly on its environment and diagram. Moved descriptive prose below
  the diagram into Notes & references, shortened actions, and removed repeated instance/ownership
  boilerplate. Placement technology is visible on instance cards; the object picker distinguishes
  repeated identities by placement. Selected replica arrows still disclose their meaning.
- Reduced card geometry where labels were removed, recovered the old caption space, and fixed
  the focused-view hidden-connections action so it does not collide with Diagram options.
  SVG export positions child rows from actual card height, preserving them after compaction.
- Updated the studio guide. Model descriptions, contracts, source decisions, review findings and
  runtime availability were not discarded as a substitute for UI cleanup.

Validation (no unit/E2E suite or persistent test changes):

- `pnpm lint`: passed, **797 files**, zero errors; 1995 warnings and 75 infos remain.
- `pnpm typecheck`: all workspaces/scripts passed. Final web/spec and subsequent final web
  typechecks passed after the presentation adjustments.
- `pnpm --filter @jeeves/web build`: final production build passed; existing large-chunk
  advisory remains.
- Temporary live-browser scripts verified source inspection, deployment preset/cancel,
  replica edit/save/reload/undo/redo, component creation from the library and undo, and the
  Mattermost default in New project. Ordinary mouse controls were used.
- Axe WCAG 2A/2AA/2.1AA: zero violations for selected C3, desktop/narrow deployment,
  focused C2, component library, project chooser, dark C3, dark deployment and narrow examples.
  Menu transitions were allowed to settle before final accessibility checks.
- No browser page errors in final inspections; no card-content overflow in the inspected C2 or
  deployment view. Both narrow deployment and library remain exactly 390px wide at 390×844.
  The hidden-connections action was directly clicked at 1600px and 390px and opened its dialog.
- Real handoff SVG download succeeded. All nine C3 rows in the focused messaging C2 export
  fit inside their parent cards. Reviewed screenshots stay under `/tmp`, not in repository clutter.
- Main Mattermost project remains revision 1 with seven containers and twelve components.
  All UX3/UX4 disposable inspection projects were deleted by exact ID; none remain.
- Scoped diff/format checks pass. Historical handoff bytes remain untouched before this entry.

The user's README was edited and staged concurrently. Both its working copy and staged content
are preserved; the scoped commit excludes it. No GitHub push, generation expansion or capacity
claim. Dense whole-system diagrams still require zoom or focused views; this pass reduces UI
noise without pretending an arbitrary large architecture can be legible at every zoom level.

## 2026-11-01 — REPO3: publish a self-contained Jeeves Docker image

The user requested an image built/published from main, a two-command run path, and Mattermost
on first launch. They authorized pushes to main and chose a public image with a private source
repository. Root README edits are limited to the two commands in their existing shell block.

- Added an Alpine/Node 24 multi-stage image containing the production web build, API, PostgreSQL
  17 and nginx. Moved the existing pinned tsx dependency into server production dependencies.
  Workspace paths, template scaffolds and release artifacts remain available at runtime.
- One named `/data` volume retains the database, settings/library and generated project folders.
  Automatic migrations and the existing empty-install Mattermost flow require no manual setup.
  Database and API remain bound to container loopback; the documented host port is also loopback.
- Added an entrypoint with database readiness, process failure detection and ordered shutdown.
  Postgres, API and nginx run unprivileged; startup adjusts persistent-directory ownership.
  Nginx serves the built UI and streams API responses without proxy buffering. Health checks
  exercise the API/database through the public container port.
- Adapted automation-pitch's GHCR workflow, with pinned actions, AMD64/ARM64 builds, cache and
  commit tags. Normal pushes to main and manual main runs publish a commit image. Only a candidate
  that starts and restarts successfully is promoted to latest; concurrent builds are serialized.
- Added docs/docker.md for persistence, updates, separate database configuration, image publication
  and operational limits. The image does not include a Docker daemon for generated applications.
  Public package visibility needs the owner's one-time GitHub web setting after first publication;
  the supported Packages API and current gh session cannot change that setting.

Validation before pushing this completion:

- `docker build --progress=plain -t jeeves:repo3 .`: passed, including frozen production dependency
  installation and the production web build (existing large-chunk advisory only).
- `pnpm lint`: passed, 798 files; zero errors, 1995 warnings / 75 infos.
- `pnpm typecheck`: passed across all workspaces and scripts. No unit/E2E suites or test maintenance.
- Temporary real-browser inspection against the image on port 4320: fresh installation creates
  exactly one Mattermost project with seven containers and twelve components. C2, C3 and Deployment
  render; zero page errors. Screenshots stay in /tmp. No development database was used or changed.
- Container health is healthy; UI returns 200 with no-cache, invalid API route returns JSON 404.
  Process inspection confirms the API/nginx and Postgres run as non-root users.
- Restart preserves project ID/name, revision and the entire design. Terminating the API makes
  the container exit 1 and stop Postgres cleanly. Recreating the container on the same volume
  preserves the edited project and a settings-file marker. A fresh browser reopens that project
  without creating another example.
- Bash syntax, parsed workflow YAML and scoped diff checks pass. The initial nginx stderr
  permission problem was corrected and verified before this completion.

The user's documentation commit edeb2df picked up the initial Docker scaffold during work.
Preserved that commit and cancelled its incomplete first workflow run (41352127268); this follow-up
contains the validated startup fixes and latest promotion guard. Publication and anonymous pull
are verified after pushing this commit, using GitHub Actions and the owner's package visibility
setting. The user's separate README prose edits remain outside this package commit.

### REPO3 publication evidence

- Pushed 965cdef to main. GitHub Actions run
  https://github.com/ashfordhill/jeeves/actions/runs/41352665991 passed in full: AMD64/ARM64 build,
  registry push, pull/start, restart, and guarded latest promotion.
- Published index digest:
  `sha256:6eaea162db0315e699d1f0aa6c26856652be0eeede3b4417bc905d0e4e1142cc`.
  Both published-image health checks returned `status: ok` and `database: ok`.
- Independently verified the optional external-Postgres mode in isolated disposable containers:
  healthy API, no bundled database initialized, and exactly one Mattermost example on browser open.
- Removed every disposable inspection container, volume and network created for this package;
  the user's development containers and database were not changed.
- Confirmed the repository remains private. At this checkpoint the new image is also still private;
  an unauthenticated registry-token request returns HTTP 401. Sent the owner the direct package
  settings link and requested the one-time Public visibility change, as authorized by their choice.
  Anonymous pull verification remains pending that external setting; do not claim it has passed.
- The root README commit changes only the existing shell block (two command lines). The user's
  separately staged prose and untracked component-library screenshot remain outside our commits.

### REPO3 public image verified

The owner changed the package to Public. Confirmed an anonymous `docker pull` using an empty
Docker configuration directory (no registry credentials), then ran that downloaded image on a
fresh named volume. Mattermost opened automatically with seven containers and twelve components;
C2, C3 and Deployment rendered with zero browser errors. The published ARM64 image also pulled
anonymously and reached healthy API/database status under Docker's ARM emulation. The manifest
contains exactly Linux AMD64 and ARM64. Verified index:
`sha256:7dbd252471a1cbc099eac5a679957bcfa59614743092c5122c78429acb1b7c6f`
(revision 54551a3; workflow 41353635480 passed). GitHub confirms the source repository is private.
Updated the Docker guide to reflect public availability; no additional root README changes.
Removed the public-image inspection containers and volumes. Public pull verification is complete.


## 2026-11-01 — UX5: Mattermost backend design review and richer C3 contracts

The user requested a review of Mattermost through Jeeves to improve C2/C3 backend design and
component configuration ahead of deterministic TypeScript templates. Read README, PLAN §1–§15,
C4 guidance, roadmap/direction review, studio guide and recent handoffs. Inspected the official
Mattermost architecture and pinned API/post/channel/file/WebSocket/job source. Page layout and
new runtime/code generation remain outside this work.

- Recorded the findings, C2 decisions, template/application boundaries and prioritized remaining
  design work in [the backend review](reviews/mattermost-backend-review-2026-11-01.md). Keep seven
  C2 boundaries; additional processes/infrastructure require a specific design reason.
- Added reusable Realtime delivery and File lifecycle C3 families. Expanded authorization,
  repository, workflow, notification and worker options. Removed the repository's unearned
  default outbox guarantee; added database polling and more appropriate workload units/boundaries.
- Added bounded nested object/array shapes, nullable values, text enumerations and type-appropriate
  numeric/length/item constraints. Invalid combinations, duplicate fields, inconsistent bounds
  and excessive nesting are rejected. Unknown nested shapes remain saveable and reviewable.
- Added operation behavior and outcomes: access, preconditions, state/transaction boundaries,
  idempotency, effects, acceptance criteria and template/hook ownership; outcome status, state,
  retry decision and optional payload. These are design specifications, not executable rules.
- Added explicit contract coverage and review findings for partial/unreviewed definitions and
  missing operation decisions. Referenced coverage, shapes and behavior remain immutable by exact
  version. Handoff JSON and Markdown retain coverage independently from shape resolution.
- Component sidebars show operations/outcomes and open the selected contract. Nested fields and
  review details are collapsible. Resource-scoped access can now be distinguished from customer
  tenant isolation in bindings and dataset configuration.
- Expanded the Mattermost example to thirteen C3 components, nine explicitly partial contracts,
  twelve bindings, three datasets and three scenarios with failure branches. Added membership
  ownership, internal post and job-claim contracts, typed file IDs/nested metadata, history
  reconciliation, lost acknowledgement, partial file persistence and interrupted job effects.
  Proposed TypeScript hooks and recovery choices are distinguished from inspected source facts.
- Created persistent local project `9928f0b6-c54c-4081-b8d4-5bdff0b5875c`, revision 1, named
  **Mattermost · backend design review** through the normal example workflow:
  `http://127.0.0.1:4300/?project=9928f0b6-c54c-4081-b8d4-5bdff0b5875c&level=components&container=server`.
  Confirmed the original Mattermost project's complete design response remains unchanged.
  Fresh example creation uses the expanded model; existing projects are not silently migrated.

Validation (the standing UI-work instruction defers unit/E2E suites and their maintenance):

- `pnpm typecheck`: passed across all workspaces and scripts.
- `pnpm lint`: passed; `Checked 802 files in 389ms. No fixes applied.` Zero errors,
  2025 warnings / 75 infos.
- `pnpm --filter @jeeves/web build`: passed; 7446 modules transformed, existing large-chunk
  advisory only.
- Temporary direct validation: all seven built-in examples parse and have zero structural
  errors excluding expected NEEDS_TEMPLATE availability findings. Checked nested constraints,
  recursive unresolved review, bounds, duplicate identities, excessive nesting, immutable
  referenced shapes/outcomes/coverage, explicit successor versions and operation-tool JSON
  Schema conversion. Handoff round trip retains the exact authored operation shape and coverage;
  extracting the Post service into a reusable library fragment retains its behavior.
- Direct Playwright browser interaction, without the E2E runner or persistent test code: new
  family selection, configure/cancel/save/reload/undo/redo, protected contract inspection, explicit
  successor creation, nested field/constraint and behavior editing, saved reload and selected
  contract navigation. All passed.
- Axe WCAG 2A/2AA/2.1AA: zero violations for protected operation behavior, file lifecycle options,
  390×844 file configuration and the C3 sidebar. Zero browser page errors; narrow document width
  remains 390px. Screenshots inspected under `/tmp/jeeves-mattermost-review/`; no tracked image
  clutter. Confirmed the persistent review project reports **Design review incomplete**.
- Removed all disposable inspection projects by their exact IDs. Development web/API remain
  available on their usual loopback ports. Scoped diff and local documentation links checked.

Compatibility and remaining work: optional contract fields preserve old saved designs; older
planned contracts now receive explicit coverage/behavior advice rather than an implied complete
review. Legacy suites may need expectation updates when their maintenance resumes. Dynamic-key
map/union/reference schemas, full API import, structured aggregate/state-machine rules and exact
operation-to-effect links remain gaps, documented with priority. The history dictionary stays
explicitly unresolved. Lifecycle, revocation, recovery and workload budgets remain open choices.
The whole C3 graph still needs zoom/focus at overview scale. No new runtime/template generation,
capacity verification, GitHub push or container publication.

## 2026-11-01 — PLAN58: partitioned backend benchmark implementation roadmap

The user requested a detailed plan for future implementation agents to build substantial Discourse,
Vendure and Zammad backend foundations through Jeeves, aiming for at least 60% verified templated
behavior and explicit remaining agent work. This package is documentation/planning only. Read the
README intentions, PLAN §15 and relevant historical contracts, current C4/studio guidance, recent
handoffs, UX5 review and current spec/registry/generator/runtime/acceptance/orchestrator code.
Inspected the application baseline at `3ae6aff` on main and checked primary upstream documentation.

- Added [the roadmap](build-plan-backend-benchmarks.md), with 53 delivery packages P58–P110 split
  into [79 sequential agent assignments](plans/backend-benchmarks/execution-units.md). Each parent
  specifies outcome, prerequisites, code pointers, ordered scope, acceptance, verification profile
  and exclusions. Mandatory child boundaries keep larger work out of a single agent session.
- Added a shared implementation contract, inspected gap map, finite backend model/configuration
  vocabulary, precise generation/ownership/evidence rules, and explicit planned-C2/C3/relationship
  compilation bridging. Existing validation and immutable artifacts are preserved.
- Defined three frozen-scope proposals with 20 weighted capability rows each, 100 points per app,
  a candidate 66-point template path, critical failure vetoes, five detailed scenarios per app,
  all remaining hook contracts, and proposed measured workload profiles. These are bounded backend
  adaptations, not full upstream clones or measured current generation coverage. Vendure's initial
  REST adaptation and reference-provider versus real-provider coverage are explicit.
- Added a worked private-topic trace through authoring, transaction/outbox, worker, ownership and
  independent failure observations. Included source links and the requirement to pin inspected
  upstream excerpts before implementation.
- Added X1–X8 stretch scopes covering GraphQL, Medusa-style compensation, local social/realtime,
  ActivityPub, GitLab-informed deployment, alternative search/cache, ERP workflow and contract import.
- Linked the plan from AGENTS, PLAN, docs index and improvements. Preserved the UI-test deferral,
  sequential primary-checkout workflow, local-commit rule and requirement to request an execution
  unit before starting implementation. Root README and CATALOG offerings remain unchanged.

Validation:

- `pnpm lint`: passed, 802 files checked; zero errors, existing 2025 warnings / 75 infos.
- Temporary documentation audit: 15 new/entry-point documents; 182 local links/anchors resolve;
  53 unique ordered parent packages and 79 unique ordered work units; all parent sections have
  scope/dependencies/checks/exclusions; dependency directions are acyclic by ordered package ID.
- Each ledger has exactly 20 unique rows, weights total 100, and G target weights total 66. No
  actual implementation or verification credit was invented. Markdown fences and JSON examples
  validate. Scoped whitespace/diff checks pass.
- No application source, runtime, dependency, database, generated project or UI changed; typecheck,
  production build, unit/E2E suites and browser/runtime campaigns were not rerun for documentation.
  The documentation audit script/result stayed under /tmp; no persistent test suite was added.
- Earlier handoff content is retained byte-for-byte; only this entry is appended. No push or publish.

All P58–P110 implementation packages remain **unstarted**. The next execution unit, if requested,
is **P58**: record the concrete baseline and verification policy before new backend development.
The plan makes the existing full-check versus deferred-UI-test boundary explicit for that future
baseline; it does not silently authorize deferred UI suite maintenance or claim those suites pass.

## 2026-11-01 — P58: repository baseline and verification profiles

Executed the requested unsplit P58 against PLAN58 commit
`0c96aae3b3e5b226cad7ac8284ef5ecb36b310f4`, initially clean on the primary `main` checkout.
Read AGENTS, PLAN §1–§15, UX5/PLAN58 handoffs, the benchmark roadmap/shared contract/scopes/queue,
P58, developer workflow, runner/configs and the named generator/evidence code. No delegation,
branch/worktree creation or new backend implementation.

- Added [P58 evidence](evidence/p58/README.md): exact checkout/toolchain/lock identity, observed
  passes versus unrun checks, 14 template pins and legacy-to-current REST runtime mapping,
  frozen artifact hashes, protected generation/architecture fixtures and current gaps.
- Documented A/S/R/P requirements and 43 concrete existing unit/conformance file selections,
  with offline logic versus real dependency/consumer evidence distinguished. Inventoried all
  15 web unit files, shared rendering tests and 41 deferred editor E2E specs. Static selector
  drift includes App/shell Draw versus Design and historical Generate/project controls; these
  remain explicitly **unverified**, not observed repository test failures.
- Reserved `backend-foundation`, `benchmark`, `benchmark-recovery`, `benchmark-load` and
  `benchmark-upgrade` in documentation only. No registered command or success-returning stub.
- Updated the developer workflow and roadmap/entry-point links to the P58 evidence and P59-next
  status. CATALOG and all actual offerings/availability remain unchanged.
- Inspected existing Mattermost backend-review project `9928f0b6-c54c-4081-b8d4-5bdff0b5875c`
  (revision 1) and Fieldwork Inventory project `477e4122-f898-4678-a6b6-1787a105d655` (revision 2).
  Used production Vite assets and actual API handlers over a PostgreSQL read-only connection,
  rejecting writes, without startup migrations/recovery or the persistent job runner. Temporary
  Settings were empty; no private provider configuration was read. Stopped inspection processes.

Commands and actual results:

- Existing `runWork` with an explicit temporary `p58-authoring-baseline` plan: `pnpm lint`,
  `pnpm typecheck`, `pnpm --filter @jeeves/web build` all exit 0, total 9.4s. Lint:
  `Checked 802 files in 377ms. No fixes applied.` Existing 2025 warnings / 75 infos, zero errors.
  Build: 7446 modules, existing chunk-size advisory. Runner evidence:
  `.jeeves-work/runs/2026-11-02T02-59-25-201Z-p58-authoring-baseline-ba368ebd.{json,log}`;
  identical initial/final fingerprints, `sourceChanged: false`.
- Direct Chromium inspection, light 1440×1000 and dark 390×844: expand Post service CreatePost,
  inspect Partial/protected contract behavior/outcomes, Cancel/reload, and select/reset the
  legacy fixed acceptance pack without invoking generation. Four observations complete; zero
  page errors, zero write requests, unchanged hashes for project list/design/layout/generation
  responses, document widths 1440/390px. Final runner exit 0 in 4.1s:
  `.jeeves-work/runs/2026-11-02T03-10-18-337Z-p58-browser-inspection-839ac0d8.{json,log}`.
  Raw observations/screenshots under `.jeeves-work/p58/`. Two preliminary driver runs failed
  on selector/loading assumptions and remain recorded; one also detected in-flight doc edits.
  The completed run has `sourceChanged: false`; no production code/test expectations changed.
- Read-only SHA-256 audit: six frozen archives and ten immutable QR Studio recipe artifacts
  match manifests. Temporary scoped documentation audit validates links/anchors, all 43 selector
  files, balanced fences and absence of the five reserved names from registered profiles.
  `git diff --check` passes. Local audit script: `.jeeves-work/p58/audit.py`.
- Full `pnpm check`, unit/E2E suites, template/consumer conformance, application generation,
  workload/recovery/upgrade campaigns and provider calls **not run**. P58's D/A baseline scope
  does not authorize the deferred UI suites. No current full-green or benchmark-coverage claim.

Known issues and next assignment:

- At 390px the existing legacy Generate drawer log overlaps form content. Selection works, but
  this is not a clean narrow-layout pass; preserve the visual observation for a separate UI fix.
- Full `pnpm check` includes deferred UI tests. Before a non-UI implementation gate (starting
  P59, certainly before runtime entry P74a), resolve execution of the unchanged full check versus
  an explicitly approved scoped backend gate. P58 records this constraint without changing the
  user's deferral, repairing assertions or weakening the root gate.
- P58 is complete; **P59 is the next unstarted work unit**. No new model/compiler/runtime,
  generated output, persistent database record, live application adoption, push or publication.

## 2026-11-02 — P59: frozen behavior ledgers and truthful coverage evaluation

Executed P59 only in the primary checkout on `main`, after P58 commit
`3ec91e6a6976354542fc7efae841924c2cf39a3d`. Read AGENTS, PLAN §15 and the relevant earlier
sections, latest handoffs, benchmark roadmap/shared contract/scopes/assignment queue/P59,
`evidence.ts` and generator acceptance handling. Resumed the same partial work after the host
shutdown; preserved the new benchmark files and existing index edit. No delegation, branches or
worktrees.

**Batch authorization for subsequent agents:** the user authorized P59 through P61d sequentially,
with a fresh task per work unit, required checks, append-only handoff and one scoped local commit
before the next unit. For this batch, **lint, repository-wide types and focused offline backend
semantic/compatibility tests replace full `pnpm check`**. UI unit/E2E execution and maintenance
remain deferred. This resolves P58's entry-policy constraint for this batch; it does not change
root scripts or authorize deferred UI maintenance, runtime work, pushes or publication. This task
owns P59 only and stops after its commit. The coordinator may assign P60a in a fresh task.

Built:

- Added `benchmarks/{discourse-core,vendure-core,zammad-core}/v1/{manifest,requirements,integrity}.json`.
  All 60 row descriptions/IDs/weights/G-H labels match the planning tables verbatim. Each profile
  totals 100 points; rows 01–12 target 66 and rows 13–20 target 34. There are 66/63/66 mandatory
  observations (195 total), covering success, rejection/access and material failure behavior.
  Expanded all named critical boundaries into immutable veto observation IDs. V03 explicitly
  explains why pure arithmetic has no separate retry/recovery observation; no N/A creates points.
- Froze scope/exclusions, prerequisite dependencies, fixture version and unmeasured workload
  targets (cardinality, offered rates/mix/duration, latency, reference-host, contention and recovery
  conditions). Source-map locators reserve sibling `source-map.json` files for P60a/b/c; none
  exists or claims inspected upstream evidence yet. Protocol/fixture contents remain P61 work.
- Added/exported `packages/spec/src/benchmark.ts`: strict schemas, cross-reference/category/total
  validation, acyclic dependencies, canonical SHA-256 integrity checking, exact-input evidence
  matching, weighted evaluation, deterministic JSON/text summaries and path/value version diffs.
  Changing frozen behavior requires a newer version and visible diff; existing v1 pins remain.
- Evidence separates design declarations, supported/generated/custom-required/unsupported state,
  implementation origin, fresh-generation/project-code/provider mode and independent raw report
  references. Inputs bind profile/ledger/design/lock/contracts/fixtures/version/seed/test-pack,
  template/runtime/archive/source hashes, DB version/image and environment profile/fingerprint.
  A template result also requires its exact reference in `templateHashes`; local reference-provider
  results cannot satisfy concrete-adapter V14/V19 observations.
- All mandatory observations and dependencies must pass before a row earns its weight. Partial,
  skipped, unrun, unavailable, interrupted, stale, wrong-origin and unreported passes earn none.
  Matching failures survive later passes and origin relabeling. Critical missing/failing evidence
  and any incomplete/failing advertised supplied path prevent a foundation pass even above 60
  template points. Shared/domain-template, recipe, upstream integration, custom completion,
  designed, missing and failed points stay separate. No recorded benchmark pass was created.
- Added focused adversarial evaluator tests and [the data/API guide](../benchmarks/README.md).
  Updated roadmap/improvements status to P59 complete/P60a next. No CATALOG change: offerings,
  reusable C2/C3 boundaries and template/runtime availability have not changed.

Final checks (Node **24.21.0**, pnpm **12.16.1**; Node selected through
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`):

- `pnpm lint`: exit 0; `Checked 813 files in 349ms. No fixes applied.` Zero errors,
  existing 2025 warnings / 75 infos; no new diagnostics. Raw output:
  `.jeeves-work/p59/lint.log`. Scoped Biome also reports zero diagnostics.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces and scripts,
  8.4s. Evidence: `.jeeves-work/runs/2026-11-02T23-40-37-947Z-typecheck-be1c24e3.{json,log}`.
- Exact offline selector:

  ```bash
  pnpm work run unit packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0: **6 files, 140 tests passed**, 4.2s including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-02T23-40-37-954Z-unit-8aa970e8.{json,log}`. This proves the new
  accounting and selected legacy executable planning/writer/fixture/acceptance compatibility,
  not real backend application behavior. Both final runner records have `sourceChanged: false`.
  The earlier same selection passed before the final diff-validator guard was added; it was rerun
  after that final source change. Synthetic adversarial observations exist only inside unit tests.
- Temporary scoped documentation/data audit: **99 local links/anchors**, balanced fences, all six
  canonical data hashes, 60 rows/195 unique observation IDs, three 100/66 totals, deliberately absent
  P60 source-map sidecars and exact preservation of the entire earlier handoff prefix. Script/result:
  `.jeeves-work/p59/audit.{py,json}`. `git diff --check` passed.

Canonical pins (`canonical-json-sha256-v1`; sorted object keys, array order retained):

| Profile | Manifest SHA-256 | Requirements SHA-256 |
| --- | --- | --- |
| discourse-core/v1 | `4eeaa5032e48783091e2b3300c6df9feae574117bec432c5c1fe3a50ba1925a7` | `67ea5037e54172e1a73f2ee05b729152e0067f882192e44a2cd8aed09e844691` |
| vendure-core/v1 | `126b31b7f5639dfa6084cdcb7bb21f40f49643bb7c0f8a2f42890d136aee6bdd` | `46cec50d621ee2f1cb22a0ec73d56d8d9da1ead7fa7133b5bcc337f168e80b98` |
| zammad-core/v1 | `f21c75ab05b05b2fc7091231e32c2bfdaf435bcb8c0a0cd0dfd73c27e1c7f1f3` | `63342b9eb79e7b78c84a9551ef521239b6b161a5f1a48a85b13ce1b14217e631` |

Observed failures and scope limits, retained separately from the passing gate:

- The first post-restart `pnpm work run unit ...` did not start tests: the login shell defaulted
  to Node 18.19.1 and rejected `scripts/work.ts` with `ERR_UNKNOWN_FILE_EXTENSION`. Selected the
  already installed Node 24 toolchain; no dependency or system installation/change was needed.
- An initial broader compatibility selection included unchanged
  `packages/generator/src/architecture.test.ts` and returned **3 failed / 92 passed** across four
  files. Raw record: `.jeeves-work/runs/2026-11-02T23-29-52-484Z-unit-b60f0338.{json,log}`.
  Exact failing expectations:
  - line 269, `hides technical adapters without losing or duplicating QR operations or declared edges`:
    expects `componentPresentation(api, true)` object identity; values serialize identically.
  - line 392, `offers projected authored C3 storage uses as scenario references`:
    a projected storage-edge reference is absent from the expected scenario-choice list.
  - line 455, `keeps interface contracts in the lossless design snapshot without changing executable generation`:
    current review also reports `CONTRACT_COVERAGE` beyond the old two-code expectation.
- Confirmed these are **P58 baseline failures**, not P59 regressions: temporarily replaced only
  `packages/spec/src/index.ts` with exact `git show HEAD:...` bytes (all other pre-existing
  source remained at HEAD), ran `pnpm work run unit packages/generator/src/architecture.test.ts`,
  then restored the exact edited bytes in `finally`. The baseline run returned **3 failed / 16
  passed**, with the same names/expectations; `sourceChanged: false`. Raw record:
  `.jeeves-work/runs/2026-11-02T23-33-26-477Z-unit-f33d135b.{json,log}`. Baseline index SHA-256:
  `a34e9544a6083842742fb321c57f4d004462040749fc9d90e80484a9b2a36662`; restored edited index:
  `b65936af49a33315319727c8ef23cfd77862e9a2c0a7364b13ae9b97f752578f`. No old expectations or
  production behavior were changed. The final focused gate uses the passing legacy executable
  plan/generate/registry fixtures instead of maintaining these deferred presentation/review assertions.
- Full `pnpm check`, UI suites, production UI build/browser, conformance, upstream fetches,
  provider calls, application generation, load/recovery/upgrade campaigns were not run. P59 has
  no production UI/runtime change. No full-green repository or actual template-coverage claim.
  Evaluation accounts for supplied records; it does not attest report truth or template support.

P59 is complete with no P59 blocker. The three confirmed historical assertions remain separately
reported debt. **P60a is the next unstarted work unit**, to pin Discourse excerpts and add its source
map without altering the frozen v1 ledger. Keep later source facts, design intent, actual template
availability and independently observed passes distinct. No next task was started, no persistent
project/database/output changed, and no push or publication occurred.

## 2026-11-02 — P60a: pinned Discourse reference pack and complete D-row adaptation map

Executed **P60a only** in `/home/ash/github/jeeves` on `main`, starting clean at P59 commit
`6ecd5b3`. Read AGENTS, PLAN §15 and the relevant earlier sections, latest handoffs, backend
roadmap/shared contract/benchmark scopes/assignment queue/P60, the enterprise reference review,
cache manifest and reference-tool implementation. Used one worker with no delegation, branch or
worktree. Applied the P59–P61d batch authorization: lint/types and focused offline backend checks
replace full `pnpm check`; deferred UI suites/maintenance remain excluded.

Built:

- Appended `discourse` to [the existing source catalog](reference/architecture-sources.json).
  Selected released **v3.5.0**, confirmed by the official 19 August 2025 announcement and annotated
  tag `67904f7b4ce20bf74a2b2d8d3af6c0020d116585`, tagged at `2025-08-19T02:51:46Z`.
  It resolves to full commit **`05a304006600f36c3e45d19c9c5919f43f5541c9`**, committed at
  `2025-08-19T02:33:48Z`; the cached version constant also identifies 3.5.0. This is a released
  research snapshot, not a latest-version/dependency/security recommendation. GitHub's releases
  API lookup returned 404; the annotated tag and official release announcement establish the
  release provenance without relying on that endpoint or a moving branch.
- Added **21** selected source/license files (**304,410 bytes**) to the existing ignored cache
  through `pnpm references fetch discourse`, all SHA-256 pinned in the catalog. Included
  `LICENSE.txt` and `COPYRIGHT.md`: GPL v2 text and the program's GPL-2.0-or-later notice, plus
  trademark/third-party notices. Selected files are open-source core. No separately licensed
  feature was selected; plugins/themes/bundled third-party/hosted features remain outside the
  inspection, with no conclusion about their licensing or availability.
- Added [the source-backed review](reference/backend-benchmarks.md#discourse-core-p60a): principal
  and category access; post/history permissions; topic/initial-post transaction; revision and
  moderation/removal flows; subscription/notification eligibility; worker publication/error/mail
  retry; search; upload classification/downloads; and durable session-token context. It records
  exact source links, responsibilities, observed facts, limitations and deliberate adaptations.
  Important differences include upstream grace-period revision rewriting, after-commit queue
  publication, read-before-create notification suppression, offset search and signed byte URLs.
  None is mislabeled as supplying Jeeves's immutable history, atomic intent, crash deduplication,
  bounded keyset contract or immediate next-check byte revocation.
- Satisfied P59's reserved locator with
  [Discourse v1 source-map.json](../benchmarks/discourse-core/v1/source-map.json). It binds the
  unchanged ledger integrity, release/tag/commit/date/license metadata, 21 exact paths/hashes,
  **56 inspected ranges**, all **20 D rows / 66 mandatory observations**, source/adaptation
  references and **eight explicit H hook seams**. Every hook has inputs, results,
  rejection/recovery, safe unavailable behavior and the exact policy decisions still owned by
  P61b/P71b. Uninspected trust/privacy/inbound-email implementations are explicitly uninspected,
  not described as missing or separately licensed upstream features.
- Recorded REST/JSON/OpenAPI as the shared benchmark choice, Vendure's GraphQL-to-REST adaptation
  and the reduced Zammad first-response SLA policy. These are planning decisions, not Discourse
  source facts or completion of P60b/c. Updated the benchmark guide, roadmap/improvements status
  and enterprise-review cross-link. No CATALOG change: offerings, reusable C2/C3 boundaries and
  template/runtime availability did not change.

Checks, with installed **Node 24.21.0 / pnpm 12.16.1** selected by
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm references fetch discourse`: exit 0; **21 files downloaded and hash-verified**. No upstream
  application/dependency was installed or executed. Cache location:
  `.jeeves-work/references/discourse/05a304006600f36c3e45d19c9c5919f43f5541c9/`.
- `pnpm references verify all`: exit 0, strictly offline, **6 references / 54 files / 0 downloads**;
  all five prior pins and cached files verify alongside Discourse. Raw output:
  `.jeeves-work/p60a/references-verify.log`. Separate `pnpm references verify discourse` also
  passed for all 21 files with zero downloads.
- `pnpm lint`: exit 0; `Checked 814 files in 407ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no errors or new diagnostics. Raw output: `.jeeves-work/p60a/lint.log`.
  `pnpm exec biome check docs/reference/architecture-sources.json benchmarks/discourse-core/v1/source-map.json`
  also passed with zero diagnostics.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces/scripts, **8.4s**.
  Evidence: `.jeeves-work/runs/2026-11-02T23-52-51-769Z-typecheck-8eea2e08.{json,log}`.
- Exact focused offline compatibility/accounting selection:

  ```bash
  pnpm work run unit packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0: **6 files / 140 tests passed**, **4.3s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-02T23-52-51-765Z-unit-951f2a3f.{json,log}`. Both runner records have
  `sourceChanged: false`. These checks establish ledger/selected legacy compatibility, not
  generated Discourse behavior or benchmark points.
- Temporary scoped audit `.jeeves-work/p60a/audit.py` → `audit.json`: passed JSON parsing,
  canonical integrity and byte-for-byte preservation of **all nine P59 ledger files**, unchanged
  metadata for all five earlier reference entries, release/tag metadata, source/cache hashes,
  range bounds, complete/unique D-row and observation identities, eight hook seams, local
  Markdown destinations/anchors, immutable source-link/range resolution and exact preservation
  of the earlier handoff prefix. Two initial audit attempts caught source links spanning split
  inspected-range records; consolidated those records to the already-read spans and reran to a
  pass. No source pin or frozen requirement changed. `git diff --check` passed.

Artifact pins:

| Artifact | SHA-256 |
| --- | --- |
| Discourse source-map file bytes | `3ace90021fa47a42e510c1a3878e0369457fd44381f6c3059e34cf26eff4f2cf` |
| Discourse canonical manifest (unchanged) | `4eeaa5032e48783091e2b3300c6df9feae574117bec432c5c1fe3a50ba1925a7` |
| Discourse canonical requirements (unchanged) | `67ea5037e54172e1a73f2ee05b729152e0067f882192e44a2cd8aed09e844691` |

Scope limits and next assignment:

- No P60a blocker or plan deviation. Static excerpts do not establish an exhaustive upstream
  security/concurrency audit. The review identifies exact remaining protocol/fixture/policy
  decisions before P61b/P71a/b. The ignored cache must be fetched before an offline inspection;
  its hashes/locators are committed, the upstream files are not vendored into Git or a runtime.
- Full `pnpm check`, deferred UI unit/E2E suites/maintenance, production UI build/browser,
  conformance, providers, generation and load/recovery/upgrade campaigns were not run. There is
  no production UI/runtime change. P59's three confirmed historical architecture assertions
  remain unchanged, separately recorded debt; this package did not rerun or repair them.
- **P60a is complete. P60b is the next unstarted work unit**, for Vendure only. Parent P60 remains
  incomplete until P60b/P60c and the combined reference review. No other unit was started, no
  persistent application/database/output changed, and no push or publication occurred. Keep
  inspected source facts, intended adaptations, template availability and observed passes distinct.

## 2026-11-02 — P60b: pinned Vendure reference pack and complete V-row adaptation map

Executed **P60b only** in `/home/ash/github/jeeves` on `main`, starting clean at P60a commit
`d76543f82ad73222f094c73dbc4c75ec070d862c`. Read AGENTS, PLAN §15 and relevant earlier sections,
latest handoffs, backend roadmap/shared contract/scopes/assignment queue/P60, C4 guidance,
enterprise reference review, P60a's map and existing cache machinery. One worker; no delegation,
branch or worktree. Used the standing P59–P61d batch authorization: lint/types and focused offline
backend compatibility/accounting checks replace full `pnpm check`; UI suites/maintenance deferred.

Built:

- Appended `vendure` to [the existing source catalog](reference/architecture-sources.json),
  preserving the six earlier entries. Selected released **v3.3.0**: official GitHub release
  published **2025-05-12T11:53:38Z**, neither draft nor prerelease; annotated tag
  `2f32df1378f62cc856b8a3474b5a98df516b0c54`, tagged **2025-05-12T10:58:13Z**, resolves to full
  commit **`a4c56359ec831b0c54dd01eab14fb75455c43ab7`**, committed **2025-05-12T10:57:57Z**.
  Pinned core package metadata independently states 3.3.0. This is a stable released research
  snapshot, not a dependency/latest-version/security recommendation.
- Fetched **25 complete source/license files / 344,731 bytes**, SHA-256 pinned through the
  existing reference tool. Cached `LICENSE.md`, GPL v3 text and plugin exception. The program
  notice and core package metadata state **GPL-3.0-or-later**; a commercial agreement is an
  alternative. Selected paths are open-source core, including default job/search and repository
  email plugin source. Only the GPL text's title/preamble is listed as inspected; its complete
  file is cached. The plugin permission concerns separately distributed plugins, not permissive
  reuse of core modifications. No commercial feature/agreement or external plugin was selected;
  no conclusions about uninspected feature availability or transitive licensing.
- Added [the Vendure review](reference/backend-benchmarks.md#vendure-core-p60b) with exact source
  links, responsibilities, facts, limitations and deliberate adaptations: permission/session/
  channel/owner/staff context; published catalog; order creation/cart/recalculation; order and
  payment guards/history; stock allocation/adjustment/release; payment handler invocation/refund
  constraints; fulfillment quantities; event/job/mail publication/retry/stop; search/reindex.
- Explicitly distinguished **upstream GraphQL Shop/Admin APIs** from planned **Jeeves REST/JSON,
  OpenAPI and HTTP/command protocol**. No schema/API parity, GraphQL runtime or X1 work.
  Important differences: default stock allocation happens on authorization/settlement, not a
  checkout reservation; upstream reuses/recalculates an Order before payment; handler results
  precede payment persistence; ordinary events are in-memory with commit-aware subscribers;
  SQL job insertion can take transaction context but the inspected email enqueue does not.
  Graceful deferral is not hard-kill recovery; row locks/ID updates do not establish lease fencing.
  Fulfillment's matching-line check does not establish a cumulative concurrent shipment ceiling.
  None is described as proving the frozen last-item/unknown-payment/replay/recovery guarantees.
- Added [Vendure v1 source-map.json](../benchmarks/vendure-core/v1/source-map.json), following
  P60a's format: unchanged detached ledger integrity, release/tag/commit/date/license metadata,
  25 exact paths/hashes, **43 inspected ranges**, all **20 V rows / 63 mandatory observations**,
  ten shared adaptation decisions and **eight explicit H hook seams**. Hooks state inputs,
  results, rejection/recovery, HTTP 503 without domain changes and exact policy decisions owned
  by P61c/P72b. V08 local payment-protocol evidence remains distinct from V19 real-provider
  verification; core fixture tax/shipping do not earn production adapter/hook points.
- Updated benchmark/roadmap/improvement/enterprise-reference entry points to P60b complete,
  P60c next, parent P60 partial. No CATALOG change: offerings, reusable boundaries and runtime/
  template availability did not change. All nine frozen P59 files and P60a's map are preserved.

Checks with **Node 24.21.0 / pnpm 12.16.1**, selected via
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm references fetch vendure`: exit 0, **25 files downloaded and hash-verified**. Raw output:
  `.jeeves-work/p60b/references-fetch.log`. Cache:
  `.jeeves-work/references/vendure/a4c56359ec831b0c54dd01eab14fb75455c43ab7/`.
- `pnpm references verify all`: exit 0, offline, **7 references / 79 files / 0 downloads**,
  including all prior files and Vendure. Raw output: `.jeeves-work/p60b/references-verify.log`.
- `pnpm lint`: exit 0, `Checked 815 files in 449ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, zero errors or new diagnostics. Raw output: `.jeeves-work/p60b/lint.log`.
  `pnpm exec biome check docs/reference/architecture-sources.json benchmarks/vendure-core/v1/source-map.json`
  also passed: `Checked 2 files in 3ms. No fixes applied.`
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces/scripts, **8.5s**.
  Evidence: `.jeeves-work/runs/2026-11-03T00-02-34-020Z-typecheck-02584323.{json,log}`.
- Exact focused offline selection:

  ```bash
  pnpm work run unit packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0, **6 files / 140 tests passed**, **4.2s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-03T00-02-34-019Z-unit-3e40691e.{json,log}`. Both runner records have
  `sourceChanged: false`. These checks establish selected accounting/legacy compatibility,
  not generated Vendure behavior or benchmark points.
- Temporary scoped audit `.jeeves-work/p60b/audit.py` → `audit.json`: passed JSON parsing,
  canonical integrity and byte-for-byte preservation of all nine P59 files and P60a's map,
  unchanged earlier reference metadata, release/tag/commit metadata, all source/cache hashes,
  range bounds, complete/unique V-row and observation identities, eight hook seams, Markdown
  destinations/anchors, immutable source-link/range resolution and earlier handoff prefix.
  An initial temporary audit had an erroneous G-target total assertion (63 instead of 66);
  corrected the audit to the frozen total without editing any ledger. `git diff --check` passed.

Artifact pins:

| Artifact | SHA-256 |
| --- | --- |
| Vendure source-map file bytes | `4dabf20337b3286b55bb02f0bc58f39d153eff84981f24731a7b4b22b780068c` |
| Vendure canonical manifest (unchanged) | `126b31b7f5639dfa6084cdcb7bb21f40f49643bb7c0f8a2f42890d136aee6bdd` |
| Vendure canonical requirements (unchanged) | `46cec50d621ee2f1cb22a0ec73d56d8d9da1ead7fa7133b5bcc337f168e80b98` |

Scope limits and next assignment:

- No P60b blocker or plan deviation. These static excerpts are not an exhaustive upstream
  audit, provider verification or an executed concurrency/recovery campaign. Exact independent
  protocol/fixture decisions remain P61a/c; data/authority and typed hook briefs remain P72a/b,
  as detailed in the review/map. The ignored cache must be fetched before offline inspection.
- Full `pnpm check`, deferred UI unit/E2E suites/maintenance, production UI build/browser,
  dependency conformance, upstream application execution, providers, generation and load/
  recovery/upgrade campaigns were not run. No UI/runtime code changed. P59's separately recorded
  historical architecture-test debt is unchanged and was not rerun or repaired here.
- **P60b is complete. P60c is next**, for Zammad and the combined reference review. Parent P60
  remains partial. Stop after this scoped local commit; no next task launched. No new runtime,
  application/database/output mutation, push or publication.

## 2026-11-02 — P60c: Zammad reference pack and combined P60 review

Executed **P60c only** in `/home/ash/github/jeeves` on `main`, starting clean at P60b commit
`6e80911e417c3c99d909d752ac93b105b02cb5ac`. Read AGENTS, PLAN §15 and relevant §1–§14,
latest handoffs, backend roadmap/shared contract/scopes/79-unit queue/phase-1 P60, C4 guidance,
enterprise reference review, existing source maps and reference-cache machinery. One worker;
no delegation, branch or worktree. The authorized P59–P61d verification policy applies:
lint/types and focused offline backend checks replace full `pnpm check`; UI suites/maintenance
remain deferred. No following work unit was started.

Built:

- Appended `zammad` to [the existing reference catalog](reference/architecture-sources.json),
  preserving all seven earlier entries. Selected released **6.5.0**, announced **2 April 2025**
  by [the official release announcement](https://zammad.com/en/product/releases/6-5).
  The lightweight tag points directly to full SHA
  **`568ebbedd173a449eea2bd8c6f456b30ce106242`**, committed **2025-04-02T06:12:02Z**;
  pinned VERSION independently states 6.5.0. No annotated tagger timestamp or GitHub Release
  API publication/draft/prerelease metadata is invented: that API returned no release object.
  The official announcement/tag/version establish a released historical research snapshot,
  not a current dependency/version/security recommendation.
- Fetched **33 complete source/license files / 178,084 bytes**, SHA-256 pinned through the
  existing tool, with **58 inspected ranges**. README's program notice states **GNU AGPLv3**
  and Foundation ownership; complete LICENSE is cached, with only title/preamble listed as
  inspected. Selected paths are open-source core. No separately licensed feature selected,
  broader license-version election or transitive licensing conclusion. Hosted/commercial terms,
  external integrations/assets/trademarks and uninspected feature availability remain excluded.
- Added [the Zammad review](reference/backend-benchmarks.md#zammad-core-p60c): ticket/group/
  customer/shared-organization policy, SQL read scope and report exception; REST create/update,
  article/internal visibility, byte/raw paths, eligible assignment, current SLA selection,
  calendar/Biz delegation/state breaks, forced rebuild, due scan/job locks, routing bounds,
  search/index/history, recipient preferences and outgoing-mail retry/ambiguity.
- Explicitly separated source facts from planned behavior. Upstream strips some privileged
  customer fields, permits configured closed-ticket follow-up, resets ineligible owners and
  uses mutable SLA/calendar rebuilds. Jeeves requires explicit rejection, expectedVersion and
  current-access rechecks, smaller lifecycle, required initial article/receipt/intent atomicity
  and immutable deadline versions. Byte/download helpers, search/mail serializers and queue
  adapters were not exhaustively audited; the review claims neither an inherited all-path
  internal-note guarantee nor an upstream exploit. Job locks/daily suppression do not prove
  fenced per-deadline effects or one logical escalation after crash/restart.
- Documented the **reduced first-response SLA**: creation start; authorized customer-visible
  agent reply stops; internal note/pending do not pause; closing cancels unmet without satisfying;
  resolved reopening creates no new clock; no closed reopening in core. Immutable America/Chicago
  calendar/SLA snapshots, explicit holidays, no remote feed, repeated fall-back time twice and
  missing spring time zero remain independent benchmark choices. Upstream communication-type
  checks, additional clocks/state breaks and mutable rebuild behavior are distinguished. P61d
  fixes dated exact UTC results independently; P87 selects the implementation library later.
- Added [Zammad v1 source-map.json](../benchmarks/zammad-core/v1/source-map.json) in the existing
  sidecar format: release/license/path/hash/range provenance, unchanged ledger integrity, all
  **20 Z rows / 66 mandatory observations**, 12 shared decisions and **eight H hook seams** with
  inputs/results/rejection/recovery/remaining decisions and HTTP 503 without domain changes.
  No uninspected inbound/connector/knowledge/privacy/reporting implementation is implied.
- Completed [the combined P60 review](reference/backend-benchmarks.md#combined-p60-reference-review):
  **60 rows / 195 observations / 24 H seams**, 36 G candidate targets totaling 66 points/app,
  **zero observed implementation points**. All three sidecars resolve to their frozen manifest
  paths. Vendure GraphQL→REST and Zammad reduced SLA choices remain explicit. Preserved all nine
  P59 files, both earlier maps, and all seven prior reference entries. Updated benchmark,
  roadmap/improvement and enterprise-reference entry points to parent P60 complete, P61a next.
  No CATALOG change: no offering, reusable boundary or runtime/template availability changed.

Checks with **Node 24.21.0 / pnpm 12.16.1**, selected by
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm references fetch zammad`: exit 0; **33 files downloaded and hash-verified**. Raw output:
  `.jeeves-work/p60c/references-fetch.log`. Cache:
  `.jeeves-work/references/zammad/568ebbedd173a449eea2bd8c6f456b30ce106242/`.
- `pnpm references verify all`: exit 0, strictly offline, **8 references / 112 files / 0 downloads**,
  including all historical sources. Raw output: `.jeeves-work/p60c/references-verify.log`.
- `pnpm lint`: exit 0; `Checked 816 files in 443ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, zero errors or new diagnostics. Raw output: `.jeeves-work/p60c/lint.log`.
  `pnpm exec biome check docs/reference/architecture-sources.json benchmarks/zammad-core/v1/source-map.json`
  also passed: `Checked 2 files in 3ms. No fixes applied.`
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces/scripts, **8.4s**.
  Evidence: `.jeeves-work/runs/2026-11-03T00-11-07-407Z-typecheck-18de491a.{json,log}`.
- Exact focused offline selection:

  ```bash
  pnpm work run unit packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0, **6 files / 140 tests passed**, **4.4s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-03T00-11-07-414Z-unit-ff2445b9.{json,log}`. Both runner records have
  `sourceChanged: false`. These are accounting/selected legacy compatibility checks, not generated
  Zammad behavior, deadline execution or benchmark points.
- Temporary combined audit `.jeeves-work/p60c/audit.py` → `audit.json`: passed JSON parsing,
  canonical integrity and byte preservation against **P59 commit `6ecd5b3`** for all nine frozen
  files; exact preservation of P60a/P60b maps against their commits and HEAD; seven prior catalog
  metadata objects unchanged; every catalog cache hash; all three maps' path/hash/revision/range
  resolution; complete/unique **60 row / 195 observation** identities; all **24 H seams**;
  local Markdown destinations/anchors and immutable source-link ranges; release/tag/version
  metadata; and unchanged earlier handoff prefix. `git diff --check` passed.

Artifact pins:

| Artifact | SHA-256 |
| --- | --- |
| Zammad source-map file bytes | `fc25b373292cc7b5bb62b546e5be39ff47a6e048f9e4aa81555669327c93b153` |
| Zammad canonical manifest (unchanged) | `f21c75ab05b05b2fc7091231e32c2bfdaf435bcb8c0a0cd0dfd73c27e1c7f1f3` |
| Zammad canonical requirements (unchanged) | `63342b9eb79e7b78c84a9551ef521239b6b161a5f1a48a85b13ce1b14217e631` |

Scope limits and next assignment:

- No P60c blocker or behavior/scope revision. The official release announcement plus lightweight
  tag/version replaces unavailable GitHub Release API metadata without guessing. Static excerpts
  do not establish exhaustive upstream security/concurrency/recovery or timezone correctness.
  The ignored cache must be fetched before offline inspection. P61a/d and P73a/b retain the exact
  independent protocol/fixture/policy and typed-hook decisions listed in the review/sidecar.
- Full `pnpm check`, deferred UI unit/E2E execution/maintenance, production UI build/browser,
  dependency conformance, upstream applications, providers, generation and load/recovery/upgrade
  campaigns were not run. No UI/runtime code changed. P59's historical architecture assertion
  debt remains unchanged, separately recorded and not rerun/repaired here.
- **P60c and parent P60 are complete. P61a is next unstarted.** Stop after this scoped local
  commit; launch no following task. No application/database/output mutation, push or publication.

## 2026-11-02 — P61a: shared benchmark protocol, fixture schema and acceptance identities

Executed **P61a only** in `/home/ash/github/jeeves` on `main`, starting clean at P60c/parent-P60
commit `1d50fc7077e7e98aaf8bb767b95ea5d01428dc8a`. Read AGENTS, PLAN §15 and relevant earlier
sections, latest handoffs, backend roadmap/shared contract/all benchmark rows/79-unit queue/
phase-1 P61, P60 adaptation review, worked command trace, generator acceptance and existing fixed
fixtures/session schemas. One worker; no delegation, branch or worktree. The authorized P59–P61d
policy applies: lint/types and focused offline backend semantic/compatibility tests replace full
`pnpm check`; UI unit/E2E execution and maintenance remain deferred.

Built:

- Added/exported `packages/spec/src/benchmark-protocol.ts`: bounded strict errors, common
  code/status meanings, safe header transport, correlation identity, cursor/page bounds,
  expectedVersion, command identity and seven-day replay constant. Reuses existing credential/
  session identity schemas and specifies the existing origin-derived cookie/session boundary;
  no new password/session implementation. Added exact-Origin/CSRF lexical validation and
  explicit application cookie-name security binding. Domain codes cannot override common ones.
- Added [protocol v1 guide](../benchmarks/protocol/v1/README.md) and
  [portable OpenAPI components](../benchmarks/protocol/v1/components.openapi.json). The guide
  fixes error/auth/paging/idempotency semantics: private lookup redaction; per-operation outcomes;
  no-store/correlation and operation-specific headers; default-25/max-100 keysets with policy
  before paging/counts; validated principal/scope/operation command identity, normalized input
  hash, atomic receipt/intent, current-access replay, conflict/in-progress outcomes and 604800-second
  retention. Callback authentication and provider uncertainty remain explicit. The OpenAPI
  snapshot comes from independent acceptance-side schemas and has **zero application routes**.
  Tests check equality; nothing is exported from runtime descriptors or observed SQL.
- Added/exported `packages/spec/src/benchmark-fixtures.ts`: strict versioned JSON fixture packs,
  independent operation/dataset/control schema registration, pinned-ledger validation, exact
  mandatory case/observation membership, isolated scopes/actor identities, unique routes/operations,
  payload/negative-payload validation, ordered and parallel request steps, connection-loss outcomes,
  fixture-only controls, literal equals/absent assertions and reference/coverage validation.
  Expected state/response assertions must agree with fixed sample values. No arbitrary code,
  runtime-derived expectations or production inspection/authentication endpoint is introduced.
  Binary/no-content success contracts can declare status-specific headers/descriptors. Real packs
  require two scopes, ordinary principals in distinct scopes, privileged/revoked/anonymous actors.
- Added [the synthetic fixture](../benchmarks/protocol/v1/synthetic.json) and focused protocol tests:
  **two illustrative operations / four T-prefixed observations / one inspection control**. The
  fixed one-token/one-receipt count is an expectation, never an observed result. Synthetic fixtures
  cannot bind a D/V/Z ledger. Real fixture parsing requires the frozen ledger and exact coverage;
  missing, duplicate, foreign/stale or unregistered identities fail. The absence helper returns
  only `not-run`/`blocked` with a reason, cannot return a pass and contains no scoring fields.
- Extended existing generator acceptance helpers with an optional explicit service-scoped backend
  catalog. Names are `backend:<profile>:<version>:<operationId>`; exact case-owned observation IDs
  remain separate. Rejects duplicate suite/behavior/reference identities, unregistered service/
  behavior/version and foreign observations; reports missing backend operation/observation pairs.
  Backend-only suites cannot claim legacy resource cases, and legacy-only suites cannot borrow
  backend observations. Existing extension/event coverage and generated ownership remain in force.
  No new runner mode, planner/generator registration or orchestration dispatch is added; P74/P79
  owns that integration and real execution. Catalog registration is a declaration, not evidence.
- Updated benchmark/roadmap/improvement entry points: **P61a complete, P61b next; parent P61 partial**.
  All D/V/Z application contracts/concrete fixtures remain P61b/c/d work. No CATALOG change:
  offerings, reusable C2/C3 boundaries and runtime/template availability did not change.

Final checks with **Node 24.21.0 / pnpm 12.16.1**, using
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; `Checked 821 files in 385ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no new diagnostics/errors. Raw output: `.jeeves-work/p61a/lint.log`. Scoped Biome
  formatting/checks also passed; new files add no diagnostics.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces/scripts, **9.0s**.
  Evidence: `.jeeves-work/runs/2026-11-03T00-23-45-754Z-typecheck-ef902a02.{json,log}`.
- Exact focused offline selector:

  ```bash
  pnpm work run unit packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **8 files / 176 tests passed**, **4.6s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-03T00-23-45-754Z-unit-3c8e6605.{json,log}`. Both final work-runner
  records report `sourceChanged: false`. Tests cover synthetic contract validation, malformed/
  unknown payloads, auth/header/page/version bounds, literal expectations, loss/parallel forms,
  byte/no-content declarations, registered identities, absence reporting and selected existing
  ledger/evidence/extension/event/plan/generate/registry compatibility. These are offline semantic
  and temporary legacy-fixture checks, not running D/V/Z applications or benchmark points.
- Temporary scoped audit `.jeeves-work/p61a/audit.py` → `audit.json`: **125 local links/anchors**,
  balanced fences, JSON parsing, all canonical ledger hashes, byte-for-byte preservation of
  **nine P59 files against `6ecd5b3` and three P60 source maps against their respective commits**,
  unchanged reference catalog/review, package/dependency files and runtime/artifact trees, and
  earlier handoff prefix preserved. `git diff --check` passed. This audit was rerun after the
  append-only handoff.

New artifact pins:

| Artifact | File-byte SHA-256 | Canonical JSON SHA-256 |
| --- | --- | --- |
| Protocol OpenAPI components | `7792e34c52113dbc1e882fc2ddc11cf662f5b1574d499316eec075583a38dc26` | `b65cdaa6e99a78b798c5821d0c1018a57753cdb4e2e15319f1345d9f59afbeca` |
| Synthetic input/expectation fixture | `8fbb150933b59a81178a94ebf6d96a478bf9fd203129f3129e9600b3470edfcd` | `838e8c7c7afa10dc05e1e51cda42170bb860d1079426f25e9fcef838d402a115` |

Observed failure and scope limits:

- An intermediate focused run returned **1 failed / 175 passed**, exposing that `new URL` inside
  the Origin refinement threw for invalid text before returning a validation failure. Added
  `URL.canParse` before construction and reran the complete focused selector/typecheck/lint.
  Final results above pass. The failed report remains at
  `.jeeves-work/runs/2026-11-03T00-22-56-954Z-unit-1e85254e.{json,log}`; no expected behavior was
  weakened or failure report replaced.
- No P61a blocker or scope revision. JSON is used for the shared OpenAPI component document;
  application children still own the specified per-app `contracts.openapi.yaml`. Fixture schema
  validation proves structure, references and fixed payload consistency, not live authorization,
  idempotency, concurrency, durability, byte access or calendar behavior. A lexical cursor is not
  an authenticated cursor. Later adapters must preserve raw independent evidence and ownership.
- **All three applications remain absent/not run, with zero observed implementation points.**
  No app fixtures, benchmark result/pass records, new runner/profile command, runtime implementation,
  core application generation, database/output mutation, provider calls, upstream execution or
  load/recovery/upgrade campaign. Full `pnpm check`, deferred UI suites/maintenance and production
  UI build/browser were not run. Historical P59 architecture assertion debt remains unchanged.

**P61a is complete; P61b is the next unstarted work unit.** Parent P61 remains incomplete until
P61b/c/d provide the application contracts, all concrete observations and combined 60-row gate.
Stop after this scoped local commit; launch no next task. No push or publication.

## 2026-11-02 — P61b: independent Discourse contracts, fixed fixtures and five scenarios

Executed **P61b only** in `/home/ash/github/jeeves` on `main`, starting clean at P61a commit
`bb6d54ebd3cf17b642daca3787ee70da5f9ced0d`. Read AGENTS, PLAN §15/relevant earlier sections,
latest handoffs, backend shared contract/benchmark scopes/79-unit queue/phase-1 P61, protocol v1,
P61a schema/identity interfaces, existing fixed acceptance and the Discourse P60 review/source map.
One worker; no delegation, branch or worktree. The authorized P59–P61d policy applies: lint/types
and focused offline backend semantic/compatibility checks replace full `pnpm check`; UI unit/E2E
execution and maintenance remain deferred. No following work unit was started.

Built:

- Added [the Discourse acceptance pack](../benchmarks/discourse-core/v1/README.md): **35 unique
  operations, 20 D rows / all 66 unchanged observations, 16 typed datasets, two isolated scopes,
  eight actors, 159 fixed request samples, 20 negative payloads and 241 ordered/control/parallel
  steps** in exactly D-create, D-revoke, D-edit, D-failure and D-moderate. The typed fixture entry
  calls P61a's pinned-ledger parser; acceptance identity registration uses its existing interface.
  Every operation has exact observation ownership. No runner integration/alias is added.
- Added independent strict request/success/dataset/control and pure-hook schemas in
  `packages/spec/src/discourse-benchmark.ts`. `contracts.openapi.yaml` is OpenAPI 3.1 in JSON
  syntax (valid YAML 1.2), exported only from these acceptance-side schemas and shared P61a
  components. Snapshot equality is checked offline. Per-operation access declarations distinguish
  public/session/admin/moderator/owner/provider paths. Fixture inspection, clock, barriers, faults,
  rebuild, restart/drain and reference-provider controls remain outside application routes.
- Fixed seed identities, clocks, trusted membership, grants, versions, immutable revisions,
  subscription states, trust activity, projection metadata and legal hold. Expected values are
  authored literals, never runtime-generated: one created topic/post/receipt/intent after lost
  response/replay; zero after precommit rollback; one simultaneous command owner and in-progress
  follower; exactly one v3→v4 edit and one appended revision; one moderator review winner/audit;
  one inbox/effect receipt after crash/restart; precise orphan association/recovery/cleanup.
  Command, worker-effect, source-message and external-delivery identities/counts remain distinct.
- Defined complete revocation/redaction on detail/posts/history/list/search/current proxy bytes,
  old cursor, stored command replay and pending notifications; interleaved inaccessible keyset
  rows, query/scope/tamper cursor rejection, projection rebuild, hidden/removed history/search,
  tombstone/no-op removal and protected metadata-only audit. The fixed six-byte `hello.txt` is
  **intentional attachment test data**, verified against its SHA-256 and download descriptor.
- Added [all eight hook contracts and decisions](../benchmarks/discourse-core/v1/hooks.md),
  their JSON Schema snapshot and typed fixed input/result examples: 30-day trust thresholds and
  demotion/override; abuse false-positive appeal/moderator override; Chicago half-open digest
  windows/public selection and uncertain-send reconciliation; bounded safe rendering/mentions;
  same-category atomic split/merge preserving post/history and mute-wins subscriptions; privacy
  export/erase/hold/pseudonymization/cancellation/resume; original-byte HMAC/timestamp/sender/thread/
  MIME/message-receipt mail contract; authorized deterministic ranking/ties/600-second freshness.
  All H cases include reference success, rejection and recovery/unavailable inputs/results.
  Missing/timeout/invalid hooks return 503 without domain writes; no fallback success or observed
  hook completion is inferred. P71b still owns binding these choices to implementation briefs.
- Documented exact adapter scheduling and isolation: fixed actor cookie jars, unique sample tokens,
  reauthentication after session expiry during trust demotion, 30-second worker lease and restart
  at +31 seconds, explicit projection rebuild, bounded drains, finite retries and no live credentials.
  Privacy's single cancellation comes from a separately queued public reply to Alice, not Bob's
  already suppressed revoked delivery. Independent contract tests assert these fixture invariants.
- Updated benchmark/roadmap/improvement entry points: **P61b complete, P61c next; parent P61 partial**.
  V/Z packs, all frozen ledgers/maps, reference catalog/review and P61a files are preserved. No
  CATALOG change: no offering, reusable boundary or runtime/template availability changed.

Final checks with **Node 24.21.0 / pnpm 12.16.1**, using
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; `Checked 827 files in 376ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no new diagnostics/errors. Raw output: `.jeeves-work/p61b/lint.log`. Scoped Biome
  checks also pass with no diagnostics. No dependency/package changes.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across all workspaces/scripts, **9.2s**.
  Evidence: `.jeeves-work/runs/2026-11-03T00-46-36-768Z-typecheck-bf3967c6.{json,log}`.
- Exact focused offline selector:

  ```bash
  pnpm work run unit packages/spec/src/discourse-benchmark.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **9 files / 190 tests passed**, **4.7s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-03T00-46-36-760Z-unit-3574a39a.{json,log}`. Both final runner records
  report `sourceChanged: false`. Checks validate positive/negative requests, strict outputs/seeds,
  hook examples, snapshots, complete identities, independent invariant constants, redaction,
  session renewal and explicit absence; selected legacy acceptance/delivery/generation/registry
  compatibility remains green. These are contract/accounting checks, **not running D behavior**.
- Temporary audit `.jeeves-work/p61b/audit.py` → `audit.json`: passed **139 local Markdown links/
  anchors**, balanced fences, JSON parsing, all canonical ledger pins, exact byte preservation of
  **nine frozen ledger files and three P60 maps** against P61a `bb6d54e`, unchanged P61a protocol,
  reference catalog/review, dependency/legacy fixture/runtime/artifact/application trees; exact
  operation/observation identities, initial same-scope row relationships, intentional byte fixture
  and append-only earlier handoff prefix. `git diff --check` passed. Rerun after this append.

Artifact file-byte SHA-256 pins:

| Artifact | SHA-256 |
| --- | --- |
| Discourse OpenAPI | `5eb9d8472291d4fc2f6456a8c68174b48af7f56e48da6f63ce8070105da37076` |
| Fixed seed/request/scenario expectations | `9a56937b6bd800a7a05b2be4761a220351f5a463ea7e05c2a83036bd95475676` |
| Pure hook schema snapshot | `d3bd2fd744becea29f03b9c07f4d8fc605dbc67ebe7550d481ba5afd447f31b7` |
| Fixed pure hook input/result examples | `7baa5829a68b961c11c47e7d75989a3ff257c7062528b3f581f33711fc3af245` |
| Attachment bytes (`hello.txt`) | `5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03` |

Observed intermediate failures and limits:

- First focused contract run returned **1 failed / 10 passed**, because the newly handwritten
  cookie-hash test constant was wrong. Corrected it to the independent SHA-256 of the configured
  origin, consistent with P61a and the fixture authoring calculation. Failed evidence remains
  `.jeeves-work/runs/2026-11-03T00-34-38-013Z-unit-c9b9b518.{json,log}`. An intermediate scoped
  Biome check rejected assignment in an expression; rewrote it and reran all final checks. No
  frozen expectation or prior implementation was changed to conceal a failure.
- No P61b blocker or benchmark scope revision. JSON syntax in the requested `.yaml` OpenAPI file
  avoids adding a parser dependency and preserves precise snapshot comparison. Schema export and
  fixed-fixture validation cannot prove live policy, cryptographic cursor/provider verification,
  atomicity, worker fencing, byte access, sanitizer safety, privacy compliance or delivery behavior.
  Future adapters must execute these descriptions against real generated applications, preserving
  protected independent expectations and raw evidence. Hook reference samples are not supplied
  application hooks; SMTP ambiguity is not exactly-once delivery.
- **All three applications remain absent/not run, with zero observed implementation points.**
  No application logic/hook implementation, generated application, new runner/profile command,
  benchmark result/pass record, provider call, upstream execution, database/output mutation,
  load/recovery/upgrade campaign, push or publication. Full `pnpm check`, deferred UI suites/
  maintenance and production UI build/browser were not run. Historical P59 architecture assertion
  debt is unchanged and was not rerun/repaired.

**P61b is complete. P61c is next unstarted; parent P61 remains partial.** Stop after this scoped
local commit; launch no following task.

## 2026-11-02 — P61c: independent Vendure contracts, money/stock/payment fixtures and five scenarios

Executed **P61c only** in `/home/ash/github/jeeves` on `main`, starting clean at P61b commit
`a2fb2a7fee2cfc342e805bab1602998f78b8e103`. Read AGENTS, PLAN §15/relevant earlier sections,
latest handoffs, backend shared contract/benchmark scopes/79-unit queue/phase-1 P61, shared protocol,
P61a fixture/identity interfaces, P61b contract/fixture pattern, fixed generator acceptance and
Vendure's P60 map/review. One worker; no delegation, branch or worktree. Applied the authorized
P59–P61d policy: lint/types and focused offline backend semantic/compatibility checks replace
full `pnpm check`; UI unit/E2E execution and maintenance remain deferred. No next unit was started.

Built:

- Added [Vendure v1 acceptance pack](../benchmarks/vendure-core/v1/README.md): **42 unique
  operations, all 20 V rows / 63 unchanged observations, two isolated shops, ten actors, 16 typed
  datasets, 195 fixed request samples, 19 negative payloads and 327 request/control/parallel steps**
  in exactly V-last-item, V-repeat, V-unknown, V-expire and V-ship. Each operation has exact
  observation ownership. The typed entry validates through P61a's pinned-ledger interface;
  namespaced backend acceptance uses the existing catalog without runner/identity changes.
- Added strict acceptance-only schemas in `packages/spec/src/vendure-benchmark.ts` for requests,
  responses, seeds, privileged controls, eight hook seams, selected original-byte callback
  envelopes and outbound reference/Stripe protocols. OpenAPI 3.1 is JSON syntax in the requested
  `.yaml` file, with exact snapshot comparisons. Provider HTTP bodies describe decoded JSON
  envelopes and separately preserve the raw UTF-8 fixture string: the future adapter sends that
  string verbatim, never JSON-encodes it again. Session/admin/customer/fulfillment/seller/provider
  policies are explicit; fixture controls never appear as production routes.
- Fixed USD safe-integer bounds 0..9007199254740991, quantities 1..1000, 100-line carts,
  immutable quote/address/price snapshots, checked overflow and literal totals. Three ×1999 plus
  two ×2500 yields subtotal **10997**, tax **825**, shipping **500**, total **12322**. One ×1999
  totals **2649**; a later 2299 price yields **2971** for new quotes and leaves the old order
  unchanged. The overflow cart references a genuinely server-priced maximum variant; it does not
  obtain an extreme price from client input. Hidden variant/asset checks are independent of
  parent publication. The full cart has 100 distinct server-owned variants.
- Fixed atomic checkout zero-row rollback, one order/line/reservation/receipt/event after lost
  response, same-key changed-quantity conflict, one in-flight command owner and follower retry,
  cart CAS winner count, and last-item stock ownership. Stock separates active/held/allocated
  quantities; unknown payment's one-unit SKU stays unavailable to another checkout. Both valid
  expiry/payment lock orders have explicit schedules, including worker death before expiry
  commit, fenced restart, one expiry effect and zero charge against expired stock.
- Fixed accepted-but-timeout payment → **unknown/payment-review/held**, with **providerId null**
  until verified callback/authoritative lookup binds it. No ID is invented from an unreceived
  response. Signed original-byte callbacks bind account/shop/payment/order/request/amount to the
  persisted attempt and authoritative provider record. Unsigned, modified-byte, stale, foreign,
  wrong-order/provider/amount events cannot settle. One valid settlement plus duplicate/older
  failure leaves **one charge, one paid transition**, terminal settlement and separate event
  receipts; a second timeout resolves by same-identity lookup. Pending lookup remains explicit
  503/unknown, and neither cancellation, expiry nor a new key can dispose of held uncertainty.
- Added [eight hook decisions](../benchmarks/vendure-core/v1/hooks.md) and typed input/results:
  capped proportional promotion allocation **2/1/0** with UUID remainder tie; trusted tax quote
  provenance/hash/expiry; bounded package/rate selection; return/refund **2149 + 4298 = 6447**
  excluding shipping; seller **5997 gross / 600 fee / 5397 net** distinct from the **6947** customer
  charge; immutable rational USD→EUR **1999 ×92/100 →1839**, half-even ties; named Stripe
  signature/status/idempotency/reconciliation boundary; authenticated absolute ERP stock with
  revision 11/9/12/13 apply/stale/commitment-conflict/rollback/resume. Every H seam has reference,
  rejection, recovery and zero-write unavailable/timeout/invalid-result cases. P72b still owns
  implementation binding/briefs; no supplied hook or production certification is inferred.
- Added [provider protocol decisions](../benchmarks/vendure-core/v1/providers.md), outbound samples,
  callback hashes and fixture-only HMACs. Checked primary Stripe PaymentIntent/idempotency/webhook
  documentation for the selected **2025-03-31.basil** subset. V08 remains the local reference
  protocol; V19 requires a named concrete adapter, with account/mode/amount/status checks and
  the provider's shorter retention boundary. After 23 hours, automatic uncertain-create POST
  recovery stops and requires reconciliation; a new key cannot become a second charge. These
  independent provider fixtures are not executed adapter evidence. No P60 pin/catalog was edited.
- Covered owner/staff detail/history/receipt/list paths, interleaved private/foreign rows,
  query/scope/tamper cursor rejection, current-authorized command replay, published-only search
  and rebuild, safe audit, one inbox/effect receipt after crash/restart and redaction of a pending
  delivery after revocation. Paid quantity three ships **2 + 1**, CAS rejects a competing two,
  current-version quantity ceiling rejects two more, replay preserves one shipment, and order
  ends fulfilled v6 with onHand **7**, allocated **0**. The 16-byte `receipt.txt` is intentional
  asset/receipt test data, not customer data or a generation artifact.
- Preserved the browser boundary: the Node-only contract modules are imported directly, matching
  Discourse's pattern, and **are not exported from `@jeeves/spec`'s browser-facing barrel**.
  That barrel is byte-identical to P61b; production web build passes. Updated the benchmark,
  roadmap and improvement entry points: **P61c complete, P61d next; parent P61 remains partial**.
  No CATALOG change: no offering, reusable boundary or runtime/template availability changed.

Final checks using **Node 24.21.0 / pnpm 12.16.1** with
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; `Checked 837 files in 474ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no added diagnostics. Log: `.jeeves-work/p61c/lint.log`. Scoped Biome passes without
  diagnostics. No package/dependency/lock changes.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across workspaces/scripts, **9.9s**.
  Evidence: `.jeeves-work/runs/2026-11-03T01-17-51-523Z-typecheck-7139793d.{json,log}`.
- Exact focused selector:

  ```bash
  pnpm work run unit packages/spec/src/vendure-benchmark.test.ts packages/spec/src/discourse-benchmark.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **10 files / 210 tests passed**, **5.5s** including runner overhead. Evidence:
  `.jeeves-work/runs/2026-11-03T01-17-51-534Z-unit-0a1cb3f8.{json,log}`. Both final work-runner
  records report `sourceChanged: false`. These validate payload/schema/snapshot/identity invariants,
  independently checked BigInt totals, callback bytes/HMAC/time, visibility and explicit absence,
  plus existing acceptance/delivery/generator/registry compatibility; they are not running V behavior.
- `pnpm --filter @jeeves/web build`: exit 0, **2.44s** Vite build; existing large-chunk warning.
  `.jeeves-work/p61c/web-build.log`. No Node-crypto browser externalization warning, UI change,
  browser inspection or deferred UI suite execution. The build specifically verifies the shared
  barrel compatibility boundary after keeping Node-only acceptance modules direct-imported.
- Temporary `.jeeves-work/p61c/audit.py` → `audit.json`: passes scoped Markdown links/anchors,
  balanced fences, JSON parsing, exact operation/observation coverage and seed quantity/price/scope
  relationships; checks all canonical ledger pins and byte preservation of **nine frozen P59 files
  plus all three P60 maps**, **647 other files** including protocol/Discourse/reference/catalog/
  browser barrel/generator/registry/application/template/artifact/legacy fixture/dependency trees,
  and append-only earlier handoff prefix. Rerun after this append. `git diff --check` passes.

Artifact file-byte SHA-256 pins:

| Artifact | SHA-256 |
| --- | --- |
| Vendure OpenAPI | `cc397ba4b11f60a7d7b94605e25c5cf7c65dd3b70956f1a4f0641e6888ded13f` |
| Fixed seeds/requests/scenario expectations | `26150761e0db8b270a4d5a3730a475588e07d2dec703444497788209787dbfe1` |
| Hook schema snapshot | `a44992f2aa352c8109f2c8c38c746182f6362cd2246b4e3537377d53a509758f` |
| Fixed hook inputs/results | `22bfac4b819457ba8077634dfcd01cf69fba26cf1461e0b2dda9c8332687cd00` |
| Callback schemas | `e749deda893a8942397f97d2aedd5252541315382ac7ee273387a9ca70b28b2d` |
| Original-byte callback metadata | `7f065c2136937f7bccc261040a84acc770ca39b4ae5cff59af412e9dd1707f79` |
| Outbound provider schemas | `13da5a541803e5576f96fcc52d0b7e0cedfe3fd43370d28aa5cda0c19817612f` |
| Outbound provider examples | `6b8a15aee4dd9833cf365ed7c22cfca89a784972204e85d18341ba620404d1cf` |
| Intentional receipt/asset bytes | `144602371f31096e0d8e8e556b0fc97c46686753c8fd70fb8e6a980254c1b978` |

Observed intermediate failures and limits:

- An initial scoped spec typecheck found TS2339 in the new test helper's union response access;
  returned the explicitly narrowed response and simplified its shipment replay assertion. Final
  typecheck and all focused tests pass. An intermediate lint run found formatting errors in two
  newly regenerated JSON snapshots; applied Biome to those scoped files and reran final checks.
  Failed lint remains `.jeeves-work/p61c/lint-before-json-format.log`. No frozen expectation or
  existing implementation was weakened, and no failed runtime result was converted into a pass.
- No P61c blocker or ledger scope revision. Static schema parsing, test-only cryptographic
  calculations and independent arithmetic do not prove live authorization, production signature
  verification, concurrency/transaction correctness, actual external adapter behavior, worker
  fencing/recovery, tax law, seller onboarding, physical restock, provider certification or scale.
  Stripe snapshots cover selected fields of the pinned protocol, not complete API compatibility.
  P72a/b and later runtimes/adapters must execute the committed expectations with real evidence.
- **All three applications remain absent/not run, with zero observed implementation points.**
  No application logic, provider/hook implementation, backend application generation, runner/profile
  command, benchmark pass/result record, live credential/provider call, upstream execution, live
  database/output mutation, load/recovery/upgrade campaign, push or publication. Full `pnpm check`
  and deferred UI unit/E2E execution/maintenance were not run. Historical P59 architecture assertion
  debt is preserved and was not rerun/repaired.

**P61c is complete. P61d is the next unstarted work unit; parent P61 remains partial.** Stop after
this scoped local commit; launch no following task.

## 2026-11-02 — P61d: independent Zammad fixtures and combined P61 contract gate

Executed **P61d only** in `/home/ash/github/jeeves` on `main`, starting clean at P61c commit
`4303756`. Read AGENTS, PLAN §15 and relevant earlier sections, latest handoffs, backend shared
contract/benchmark specification/79-unit queue/phase-1 P61, shared protocol guide, fixed acceptance
interfaces, Zammad P60c source map/review and the committed D/V contract/fixture patterns. One
worker, no delegation, branch or worktree. The authorized P59–P61d policy applies: lint/types and
focused offline backend semantic/compatibility checks replace full `pnpm check`; UI unit/E2E
maintenance/execution remain deferred.

Built:

- Added [independent acceptance types](../packages/spec/src/zammad-benchmark.ts),
  [42-operation OpenAPI](../benchmarks/zammad-core/v1/contracts.openapi.yaml) and
  [typed fixture entry](../benchmarks/zammad-core/v1/fixtures.ts). All writable objects are strict;
  shared errors/headers, durable origin-derived sessions, admin/customer/agent capabilities,
  current scope/membership, canonical command replay and CAS are explicit. OpenAPI uses JSON
  syntax, valid YAML 1.2, exported solely from acceptance-side schemas. No runtime evaluator,
  generated SQL/descriptor or application response was used to construct expected values.
- Added [fixed fixtures](../benchmarks/zammad-core/v1/fixtures.json): **21 datasets, 240 requests,
  423 ordered steps, 7 standalone negative payloads, all 20 Z rows / 66 observations, five scenarios**
  (`Z-create`, `Z-private`, `Z-clock`, `Z-race`, `Z-recover`). Requests also include intentional
  malformed/unauthorized/domain/conflict/dependency cases. Initial article failure fixes zero
  ticket/article/deadline/audit/receipt/intent; lost committed response/replay fixes one of each.
  Two ticket-v8 assignments fix one v9 winner, one conflict and one actor audit. Receipt replay
  rechecks current access, including after membership revocation or a move to a restricted group.
- Fixed internal-note detail/history/export, attachment metadata/proxied bytes, search/snippet/count,
  audit, inbox and mail absence for customers. Same-organization Bob still cannot read Alice's
  tickets under default own-ticket policy. Needle pages interleave Bob/foreign records between
  allowed results. Group move revokes the former agent's detail/export/audit/search/cursor/replay,
  old byte reference and pending sensitive effects before rebuild. Included incomplete/quarantined,
  invalid-size/MIME/hash and interrupted bytes/SQL association outcomes; bounded cleanup reclaims
  an abandoned orphan and preserves the retried live association.
- Fixed seven independently inspectable UTC calendar vectors: Friday 16:00 Chicago on Oct 30 ends
  **Nov 2 16:00Z**, Monday holiday ends **Nov 3 16:00Z**; spring weekday/weekend ends **Mar 9 15:00Z**.
  Separate Sunday working intervals prove fall repeated time **05:30Z→07:30Z** and spring missing
  time **06:30Z→08:30Z**. A test-only UTC-minute enumerator checks committed values against local
  interval membership, independent of any future P87 calculator. Overlap/reversed intervals and
  calendar/SLA mismatch reject. Calendar/SLA append never changes existing v1 dueAt across restart.
  Internal/customer replies and pending do not stop first response; authorized public agent reply
  does; close cancels without satisfying; resolved→open creates no new first-response clock.
- Fixed both deadline commit schedules: response first suppresses escalation; escalation first
  retains one late outcome after the public reply. Satisfied/cancelled jobs and fenced old workers
  cannot add effects. Worker-down backlog is **9**; postcommit crash leaves one receipt; bounded
  restart progresses **9→8→6→4→2→0**, ending with **nine logical escalations/receipts**. Finite routing
  uses explicit priorities/match mode, a five-action bound and event/rule deduplication without a
  recursive cascade. One internal inbox receipt survives crash/restart; unknown external mail
  acknowledgement stays unknown until reconciliation, without claiming SMTP exactly-once delivery.
- Added [eight H decisions](../benchmarks/zammad-core/v1/hooks.md),
  [strict schema snapshot](../benchmarks/zammad-core/v1/hooks.contracts.json) and
  [host-trusted inputs/results](../benchmarks/zammad-core/v1/hooks.examples.json): bounded authenticated
  inbound MIME; visibility/provenance-preserving conversation plans; explicit resolution-clock
  pause/resume/recalculation; CRM source/field/revision authority; knowledge audience/publication;
  finite typed custom workflow; hold-aware privacy/export/erase; bounded scoped reporting.
  Each seam has reference/rejection/recovery and missing/timeout/invalid-result zero-write 503 cases.
  The separate seeded resolution clock preserves **105→135 elapsed** minutes, then explicitly
  recalculates **165 remaining** to **2026-11-03T19:00:00Z**, generation 3. Archived report identities
  1501–1513 are disjoint from active tickets 101–114: 13 tickets, one reopened ticket (two events),
  three responses and **90+30+30=150** business minutes. No future report facts contradict active
  ticket/deadline seeds. P73a/b still own design/transaction/brief binding and implementation work.
- Added [original-byte source signatures](../benchmarks/zammad-core/v1/sources.examples.json),
  [inbound MIME bytes](../benchmarks/zammad-core/v1/inbound.eml) and intentional
  [16-byte file](../benchmarks/zammad-core/v1/private.txt). Fixture-only HMAC secrets are invented;
  no live credentials/provider calls. Email precommit rollback, lost-response receipt replay,
  changed-message conflict, forged/wrong-source/unsafe sender/thread/MIME/size cases are explicit.
  CRM revision 11 applies once; revision 9 is stale; a controlled local edit produces a revision-12
  reconciliation item, preserving field authority and local v5.
- Added [Z contract tests](../packages/spec/src/zammad-benchmark.test.ts) and
  [combined P61 gate](../packages/spec/src/benchmark-foundation.test.ts). The latter validates
  **60 rows / 195 mandatory observations / 24 hooks / 15 scenarios**, exact source-map observation
  ownership, primary/supporting decision/source references, OpenAPI operation membership and local/
  relative schema pointers, distinct application cookies/namespaced acceptance identities and
  explicit not-run absence. No new acceptance runner or generator dispatch was introduced.
- Kept Node-only acceptance modules direct-imported and out of `@jeeves/spec`'s browser barrel.
  Updated benchmark/roadmap/improvement entry points: **parent P61 complete as independent contract
  work; P62a next unstarted**. Earlier P61a/b/c prose remains historical and untouched. No CATALOG
  change: no offering, reusable boundary, template/runtime availability or observed evidence changed.

Final checks with **Node 24.21.0 / pnpm 12.16.1** using
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; `Checked 845 files in 462ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no new diagnostics. `.jeeves-work/p61d/lint-final.log`. Scoped Biome: exit 0, eight
  files, no diagnostics (`.jeeves-work/p61d/scoped-lint.log`). No dependency/lock/package edits.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across workspaces/scripts, **10.3s**.
  Evidence: `.jeeves-work/runs/2026-11-03T01-44-08-478Z-typecheck-c15023a4.{json,log}`.
- Exact focused selector:

  ```bash
  pnpm work run unit packages/spec/src/zammad-benchmark.test.ts packages/spec/src/benchmark-foundation.test.ts packages/spec/src/vendure-benchmark.test.ts packages/spec/src/discourse-benchmark.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/benchmark.test.ts packages/spec/src/evidence.test.ts packages/generator/src/acceptance.test.ts packages/generator/src/delivery.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **12 files / 227 tests passed**, **5.7s** including runner overhead (Vitest 4.68s).
  Evidence: `.jeeves-work/runs/2026-11-03T01-44-08-476Z-unit-99eefc53.{json,log}`. Both final
  runner records have `sourceChanged: false`. Checks validate fixed data/schemas/identities/UTC/
  bytes/signatures plus old acceptance/delivery/generator/registry compatibility, not a running app.
- `pnpm --filter @jeeves/web build`: exit 0; **1.31s**, existing large-chunk warning only.
  `.jeeves-work/p61d/web-build.log`. No Node-crypto browser externalization warning. Build verifies
  the unchanged browser-barrel boundary; no UI change, browser inspection or deferred suite work.
- `.jeeves-work/p61d/audit.py` → `audit.json`: scoped links/anchors/fences/JSON parsing, seed
  scope/parent/calendar/SLA/file relationships, disjoint report/archive identities and counts pass.
  **12 frozen files** (nine P59 ledgers/integrities plus three P60 maps) and **664 other files**
  including protocol/D/V/reference/catalog/browser barrel/generator/registry/apps/templates/artifacts/
  legacy fixtures/dependencies are byte-identical to P61c. All **79 cached P60 source hashes** verify
  offline. Earlier handoff prefix is unchanged; rerun after append. `git diff --check` passes.

Artifact file-byte SHA-256 pins:

| Artifact | SHA-256 |
| --- | --- |
| Zammad OpenAPI | `fddefe0ed16145ac992b83e5cea83615ca68e899fea09d1f585ea6741b3f33f2` |
| Fixed seed/requests/scenario expectations | `b3e0035f078a02d5bbbc158aa4686d040179c0719a45feea7af72569ffccb736` |
| Hook schema snapshot | `664b82dd0ad47a1ba6795a6d4d77e5c5cd78cfddb1df3c0354609f947c45dc71` |
| Fixed hook inputs/results | `d657f1b373d6d9de60f7801592214477237943047aecfef161b5fa743f0d6ccc` |
| Original-byte source metadata | `efe6e01f13bb5ba517ff82cf244781c729ea83f73fd976e3cd7451db2f2cdc97` |
| Inbound MIME | `65236a2990832d79ebea0cf44441b28bb02891608d7ca2befe6d0783b999c530` |
| Intentional private file bytes | `eff97f751200f549f5fee3db29f269e548d80b38dcc9353333e21da8dcb48a89` |

Intermediate failures, scope and limits:

- The first new combined test used `manifest.rows` rather than the existing `capabilities` field;
  corrected the new test. An initial combined focused run passed 226 tests but timed out its new
  combined schema-reference traversal at five seconds. Cached repeated document/pointer validation
  without increasing timeouts or weakening checks; two subsequent combined selectors passed all
  227. Failed evidence remains `.jeeves-work/runs/2026-11-03T01-41-20-061Z-unit-588818f8.{json,log}`.
  The independent seed audit caught an omitted additional-clock dataset during authoring; added it
  and required every declared Z dataset in the contract tests. Temporary authoring script syntax/
  indentation errors were corrected before final serialization/checks. No runtime failure was
  converted into a pass, no frozen expectation/ledger or prior D/V implementation was weakened.
- No P61d blocker or ledger scope revision. Contract parsing, static fixture assertions and
  test-only independent arithmetic/signing do not prove running authorization, transaction/CAS,
  timezone-library correctness, actual provider authentication, fencing/cleanup, hook behavior,
  recovery, scale or complete upstream compatibility. Those require later generated-app evidence.
- **All three applications remain absent/not run with zero observed implementation points.** No
  application/runtime/provider/hook implementation, application generation, runner/profile alias,
  benchmark pass/result record, live credentials/provider call, upstream execution, live database/
  output mutation, load/recovery/upgrade campaign, push or publication. Full `pnpm check` and
  deferred UI unit/E2E maintenance/execution were not run; historical architecture assertion debt
  remains preserved. Backend foundation completion here means independent contracts only.

**P61d and parent P61 are complete. P62a is the next unstarted unit.** Stop after this scoped local
commit; do not start P62a or any runtime work without a fresh assignment.

Precommit byte check: the staged raw MIME fixture's required CRLF endings triggered Git's text
whitespace check. Added a [fixture-local Git attribute](../benchmarks/zammad-core/v1/.gitattributes)
marking only `inbound.eml` binary, preserving its signed original bytes across checkout/diff instead
of normalizing the protocol payload. Artifact hashes and all tested data/code stay unchanged.
The final staged `git diff --check` and preservation/link audit pass with this attribute included.

## 2026-11-02 — P62a: local reusable contract types and bounded resolution

Executed **P62a only** in `/home/ash/github/jeeves` on `main`, starting clean at `63ea4c9`
(P61d). Read the batch authorization/policy, AGENTS, PLAN §15/applicable §1–14, latest handoffs,
C4 guidance/studio guide, backend roadmap/shared contract, relevant benchmark contract shapes,
phase-2 P62 and its exact execution-unit split. P61 dependency evidence is the committed independent
D/V/Z artifacts and combined P61 gate, exercised again by the focused selector below. One worker;
no delegation, branch or worktree. Batch policy authorizes lint/types plus focused offline semantics
and compatibility instead of full `pnpm check`; UI unit/E2E maintenance/execution remain deferred.
The coordinator owns the ignored batch checkpoint; this worker did not edit it.

Built:

- Extended [contract shapes](../packages/spec/src/contract-shapes.ts) with exact local `ref`,
  bounded string-keyed `map` and `tagged-union` values. Optional `shape.types` holds at most 100
  `{id, version, name, description, value}` definitions **inside the exact contract shape**.
  This keeps contracts authoritative without adding a competing global type schema. Local IDs do
  not participate in outer architecture role remapping. See [model and limits](contract-types.md).
- Added [pure resolution helpers](../packages/spec/src/contract-type-resolution.ts): exact-version
  lookup, acyclic sharing, cycle detection, **2,000 expanded nodes / depth 20** (smaller caller
  budgets allowed), and traversal of every definition/input/output/outcome, including unused types.
  Stored references remain intact. Resolution returns no expanded value on failure; successful
  expanded values conform to the existing value schema and contain no leftover `ref` properties.
  Existing five-level inline nesting and forty-fields/object limits remain. Maps have finite key
  length and at most 10,000 entries; unions have 2–20 nonnullable object variants with required,
  nonnullable, unique single text-literal discriminator tags, including through local references.
- Missing selections/bounds/variants and explicit unresolved values remain saveable draft findings;
  stale selected versions, cycles, duplicate identities/tags, ambiguous variants and budget overflow
  reject atomic batches. Optional field presence stays distinct from nullability; a reference may
  add nullability but cannot remove nullability declared by its target.
- Integrated structural/review checks and referenced-definition immutability into
  [contract validation](../packages/spec/src/architecture-contracts.ts). A referenced local value
  cannot change/disappear even in a contract with no interface consumers or while its uses migrate
  in the same batch; removing its enclosing contract cannot bypass this guard. Definition display
  renames preserve identity. Explicit successor type/contract versions preserve old consumers.
  [Pattern matching](../packages/spec/src/architecture-patterns.ts) compares logical definitions,
  ignores local definition display names/descriptions, and refuses unresolved definition matches.
- Added [13 focused semantic tests](../packages/spec/src/contract-types.test.ts), including synthetic
  history dictionary, tagged payment, reused exact money and optional nullable address. Proved
  extraction/insertion/exact reuse, local-identity preservation under outer remapping, target diffs,
  deterministic handoff graphs/fingerprints and chat operation JSON Schema preservation through
  their existing complete-shape paths. No separate library/handoff/target source changes were
  needed. Legacy nested/source-backed contracts and saved fixtures retain their existing data.
- Updated roadmap/improvement entry points: **P62a complete; P62 remains partial; P62b next**.
  No CATALOG change: no offering, reusable C1/C2/C3 boundary, template/runtime availability or
  observed application evidence changed. No dependencies, lockfiles or frozen expectations changed.

Final checks with **Node 24.21.0 / pnpm 12.16.1**, explicitly using
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; `Checked 847 files in 542ms. No fixes applied.` Existing **2025 warnings /
  75 infos**, no added diagnostics. `.jeeves-work/p62a/lint-final.log`.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0 across workspaces/scripts, **10.4s**.
  `.jeeves-work/runs/2026-11-03T02-13-22-718Z-typecheck-d0be489b.{json,log}`.
- Exact focused selector:

  ```bash
  pnpm work run unit packages/spec/src/contract-types.test.ts packages/spec/src/architecture-contracts.test.ts packages/spec/src/architecture-library.test.ts packages/spec/src/architecture-targets.test.ts packages/spec/src/apply.test.ts packages/spec/src/schemas.test.ts packages/spec/src/resources.test.ts packages/spec/src/benchmark-foundation.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **11 files / 148 tests passed**, **5.8s** including runner overhead (Vitest 4.48s).
  `.jeeves-work/runs/2026-11-03T02-13-22-717Z-unit-3811c2dc.{json,log}`. Both final runner
  records report `sourceChanged: false`. These are offline model/compatibility checks, not
  benchmark application execution or evidence of a new runtime.
- `pnpm --filter @jeeves/web build`: exit 0; Vite **508ms**, existing large-chunk advisory only.
  `.jeeves-work/p62a/web-build.log`. This verifies shared browser export compatibility. No production
  UI file changed; no browser workflow inspection or deferred UI unit/E2E suite was run.
- `.jeeves-work/p62a/audit.py` → `audit.json`: **113 scoped links/anchors**, balanced fences,
  append-only earlier handoff prefix, and byte preservation of **1,450 other tracked files**,
  including **all 48 benchmark files / 46 legacy fixture files**, CATALOG, application/template/
  generator/registry/artifact/dependency trees. Rerun after this append. `git diff --check` passes.

Observed intermediate failures and limitations:

- Initial new-test typecheck rejected optional architecture in the operation helper; used the
  existing explicit-null operation contract. Initial test run also exposed an incorrect new
  fixture filename; corrected it. Final review caught leftover `ref` metadata in expanded object
  fields; fixed the merge and added a schema-validity/no-leftover-reference assertion. Final lint,
  workspace types, 148-test selector and build above all ran after that correction.
- A broader initial selector returned **5 failed / 38 passed** (including the new fixture-path
  failure). Four unchanged historical assertions fail: `architecture-patterns.test.ts` → `keeps
  visit and billing channels separate and requires an explicit store choice` (extra
  CONTRACT_COVERAGE/OPERATION_BEHAVIOR findings); `architecture-handoff.test.ts` → `qrwty exports
  exact portable definitions and bounded obligations`, `inventory exports exact portable
  definitions and bounded obligations`, and `binds approval to semantic names/contracts/policies
  and scope; revision/layout do not stale decisions` (Blocked versus expected review/ready status).
  Initial record: `.jeeves-work/runs/2026-11-03T02-07-09-578Z-unit-429a5017.{json,log}`.
- Confirmed those four failures against **exact base `63ea4c9` production source**, temporarily
  replacing only the three edited existing source modules and restoring every working byte in
  `finally`, with hashes in `.jeeves-work/p62a/baseline.json`. Baseline result: **4 failed /
  10 passed**, identical titles/observations; `sourceChanged: false`.
  `.jeeves-work/runs/2026-11-03T02-08-44-024Z-unit-1a8e337b.{json,log}`. No historical assertion or
  fixed expectation was edited. They remain separate review debt, not a P62a regression or a pass.
- **Parent P62 remains incomplete.** P62b owns transport method/path/status/content/header/input
  mapping, bounded binary descriptors, additional source protection and the combined end-to-end
  logical JSON Schema export gate. Current chat input-schema preservation is not that export gate.
  New mouse controls belong to P67a. A resolved design type supplies no runtime/serializer/storage
  implementation, and recursive runtime types remain unsupported.
- All three benchmark applications remain **absent/not run, zero observed implementation points**.
  No new runtime, application code generation, provider/hook execution, persistent project/output
  mutation, push or publication. Full `pnpm check`, deferred UI suites, real dependency conformance,
  load/recovery/upgrade campaigns and browser workflows were not run. No full-green claim.

**P62a is complete with no P62a blocker. P62b is the next unstarted work unit.** Stop after this
scoped local commit; do not start P62b or any runtime work in this worker.

## 2026-11-02 — P62b: transport, bounded binary bodies and portable logical schemas

Executed **P62b only** in `/home/ash/github/jeeves` on `main`, starting clean at `86d1101`
(P62a). Read the ignored batch authorization/policy, AGENTS, PLAN §15/applicable §1–14, latest
handoffs, C4 guidance/studio guide, backend roadmap/shared contract/benchmark scopes/worked trace,
phase-2 P62 and its execution-unit split. P62a's committed types/resolution and P61's frozen
independent contracts are the dependencies, exercised again below. One worker; no delegation,
branch or worktree. The coordinator owns the ignored checkpoint; this worker did not edit it.
The authorized lint/types/focused offline policy replaces full `pnpm check`; UI suites stay deferred.

Built:

- Added strict optional operation `transport` in
  [contract-transport.ts](../packages/spec/src/contract-transport.ts): HTTP method/path, stable
  logical input IDs mapped to path/query/header or JSON request fields, selected outcome/shared
  output responses, declared status/content type and response headers. Scalars resolve through
  exact local references; path values are required and nonnullable. Each logical field maps once;
  headers compare without case. Route placeholders, duplicate routes/names/statuses/outcomes,
  unmapped/missing fields, structured/nullable parameters, outcome-status/kind contradictions,
  reserved content headers and GET/HEAD/bodyless-status conflicts reject atomic batches.
- Added a distinct `{kind: "binary", contentType, maxBytes}` request/response descriptor, with
  concrete bounded media type and **1–1,000,000,000 byte** bound. Bytes never become a JSON
  string/field/type reference. JSON descriptors select logical fields and JSON or `+json` content
  types. Limits: 40 parameters/headers/body fields, 31 responses, 500-character path and 120-character
  media type. See [model and serialized contract](contract-types.md#http-mappings-and-binary-bodies-p62b).
- Integrated structural/review validation and exact matching into existing contracts/patterns.
  A captured source identity/snapshot/revision cannot be edited or converted into a planned shape
  under its exact version, even without consumers. Legacy resources remain authoritative/editable
  through their existing path; changed sources stay visibly stale, and successors capture a new
  version. Consumed transport contracts cannot disappear during same-batch consumer migration.
  P62a's referenced local-type protection remains. Historical nested/source contracts and legacy
  composition semantics remain compatible.
- Added the pure [logical schema exporter](../packages/spec/src/contract-json-schema.ts).
  It validates the whole contract, all local types/budgets and mappings before returning any schema.
  Self-contained draft 2020-12 `$defs` preserve exact local references, object presence/nullability,
  bounded maps/arrays and disjoint `oneOf` variants. Data/events select their payload root. API/
  in-process documents are catalogs of input/output/outcome/body schemas; consumers select the
  appropriate reference, rather than validating a request against the unselected catalog root.
  `x-jeeves` metadata carries method/path/status/content/header/input mappings, including scalar
  presence/schema refs. Binary bodies stay byte descriptors. Unresolved/invalid shapes return
  diagnostics without a partial schema. Source references retain their source definition without
  an inferred competing logical schema.
- Handoff JSON now includes intact typed `definition` plus `jsonSchema`, or `schemaIssues` for a
  draft. Typed property names, literals and semantic route paths survive exactly, including
  `config` and `/home/` prefixes; optional undefined properties normalize to JSON absence. Opaque
  runtime config/source examples retain existing sanitization. Library extraction/insertion,
  identity remapping, exact reuse, target diffs, fingerprints and chat operation schemas preserve
  complete graphs/mappings. No new library/reference collector schema was necessary.
- Added **12 focused semantic/export tests** in
  [contract-transport.test.ts](../packages/spec/src/contract-transport.test.ts). An independent
  Ajv 2020 reader checks real accepted/rejected instances, including map key/entry/item limits,
  reused exact money, nullable optional addresses, tagged payment results, standalone data roots,
  binary upload/download intent and every exported local pointer. Library→insert→handoff JSON
  round-trips preserve the original shape and executable schema meaning. Test-only Ajv **8.20.0**
  / ajv-formats **3.0.1** reuse the existing REST runtime's exact pins; offline installation reused
  134 packages, downloaded/added **zero**, and changed only the spec importer in the lockfile.
- Updated model/handoff docs and roadmap entry points: **P62a, P62b and parent P62 complete;
  P63a next**. No CATALOG change: no offering, reusable C1/C2/C3 boundary, template availability
  or observed application evidence changed. All frozen benchmarks/legacy fixtures and P62a
  shape/resolution/test sources remain byte-identical to base.

Final checks with **Node 24.21.0 / pnpm 12.16.1**, explicitly using
`PATH=/home/ash/.nvm/versions/node/v24.21.0/bin:$PATH`:

- `pnpm lint`: exit 0; **850 files / 655ms**, no fixes. Existing **2025 warnings / 75 infos**,
  no added diagnostics. `.jeeves-work/p62b/lint-final.log`.
- `pnpm work run typecheck` → `pnpm typecheck`: exit 0, all workspaces/scripts, **12.0s**.
  `.jeeves-work/runs/2026-11-03T02-31-02-509Z-typecheck-533ddbd9.{json,log}`.
- Exact combined P62/new semantics, P61/frozen contract and legacy compatibility selector:

  ```bash
  pnpm work run unit packages/spec/src/contract-transport.test.ts packages/spec/src/contract-types.test.ts packages/spec/src/architecture-contracts.test.ts packages/spec/src/architecture-library.test.ts packages/spec/src/architecture-targets.test.ts packages/spec/src/apply.test.ts packages/spec/src/schemas.test.ts packages/spec/src/resources.test.ts packages/spec/src/benchmark-foundation.test.ts packages/spec/src/benchmark-fixtures.test.ts packages/spec/src/discourse-benchmark.test.ts packages/spec/src/vendure-benchmark.test.ts packages/spec/src/zammad-benchmark.test.ts packages/generator/src/plan.test.ts packages/generator/src/generate.test.ts packages/registry/src/fixtures.test.ts
  ```

  Exit 0; **16 files / 240 tests passed**, **7.5s** including runner overhead.
  `.jeeves-work/runs/2026-11-03T02-31-02-502Z-unit-6a867ca6.{json,log}`. Final type/unit records
  both report `sourceChanged: false`. These are offline semantic/compatibility checks, not running
  benchmark applications or a new serializer/runtime conformance result.
- `pnpm --filter @jeeves/web build`: exit 0; Vite **1.61s**, existing large-chunk advisory only.
  `.jeeves-work/p62b/web-build.log`. No production UI file/control changed; this checks the shared
  browser bundle. No direct browser workflow or deferred UI unit/E2E suite ran.
- `.jeeves-work/p62b/audit.py` → `audit.json`: scoped Markdown links/anchors and balanced fences,
  unchanged earlier handoff prefix, and byte preservation of **1,448 other tracked files**,
  including **all 48 benchmark files / 46 legacy fixtures**, CATALOG and application/runtime/
  template/generator/registry/artifact sources. Rerun after this append. `git diff --check` passes.

Observed intermediate failures and preserved limitations:

- The initial new-test run was **236 passed / 2 failed**. The first reader (Zod's JSON Schema
  importer) ignored `minProperties`; switched to existing pinned Ajv rather than dropping any
  bound/negative assertion. A new extraction fixture lacked an interface to include its contract
  in the existing closure; added that interface. Initial failed record:
  `.jeeves-work/runs/2026-11-03T02-23-08-161Z-unit-8f193e37.{json,log}`. Subsequent selectors
  passed 238, then 239, then the final 240 tests. Temporary cleanup-script/unused-import type
  errors were corrected before the final successful workspace typecheck; no expectation changed.
- A broader initial removal guard blocked historical legacy composition, producing **8 failed /
  6 passed** in the two existing architecture files. Restricted that new removal guard to consumed
  transport declarations, preserving P62a local-type protection and old composition semantics.
  Initial regression record: `.jeeves-work/runs/2026-11-03T02-27-09-723Z-unit-c86c499a.{json,log}`.
  No historical assertion/fixture was edited to accommodate it.
- Final `pnpm work run unit packages/spec/src/architecture-patterns.test.ts packages/spec/src/architecture-handoff.test.ts`
  remains **4 failed / 10 passed**, exactly the historical titles/observations recorded by P62a:
  pattern visit/billing coverage/behavior review, QRWTY/Inventory ready/review status, and approval
  status. Final record: `.jeeves-work/runs/2026-11-03T02-31-02-506Z-unit-39622ba7.{json,log}`.
  Reproduced the same four titles on **exact base `86d1101` production source**, temporarily
  substituting the four edited existing source modules and restoring every byte in `finally`.
  Baseline: `.jeeves-work/runs/2026-11-03T02-27-39-277Z-unit-d76518de.{json,log}`;
  `.jeeves-work/p62b/baseline.json` contains hashes/restoration evidence. Both baseline and final
  historical records have `sourceChanged: false`. This is unchanged review debt, not a pass or a
  P62b regression. Full `pnpm check` was not run; no full-green claim.
- Parent P62's dictionary/payment/address/money/binary fixtures, old nested/source preservation,
  cycles/budgets/stale references/type immutability, explicit successors, atomic rejection and
  portable export gates are complete. New mouse controls stay with P67a. Runtime recursion,
  remote/OpenAPI interpretation, serializer/storage/runtime/code generation and P63 implementation
  remain outside this unit. Binary limits are declarations, not observed streaming/inspection.
- All three benchmark applications remain **absent/not run, zero observed implementation points**.
  No runtime/provider/hook implementation or execution, live database/project/output mutation,
  benchmark result, recovery/load campaign, application generation, push or publication.

**P62b and parent P62 are complete with no P62b blocker. P63a is the next unstarted work unit.**
Stop after this exact-ID scoped local commit; the coordinator owns the next assignment.
