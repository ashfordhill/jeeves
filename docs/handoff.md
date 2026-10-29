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
