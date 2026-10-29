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
