# Working with an http-service element

This service runs on `@jeeves/service-runtime` (Fastify, pino logging, Zod-validated environment,
`/health` and `/ready`, graceful shutdown). You add behavior; the runtime and the wiring stay as
they are.

## Where things go

- **Features:** one folder per feature in `src/features/<name>/index.ts`, default-exporting
  `defineFeature({ name, ... })` from `@jeeves/service-runtime`. Every folder is loaded at
  startup in name order; folders starting with `_` (like `_shared/`) are skipped, so put shared
  helpers there.
  - `register(app, ctx)` adds Fastify routes, hooks, or decorators.
  - `operations: { <operationId>: handler }` implements API operations when the service has a
    rest-api-server attachment (see that template's guide).
  - `env: { NAME: z.string() }` declares environment variables the feature needs; they're
    validated with the service's own at startup and arrive typed in `ctx.env`.
  - `start(ctx)` is a startup task (runs before the port opens); `stop()` runs on shutdown.
- **Database** (when the design connects one):
  - `import { database } from "../../jeeves.generated.ts"` and query `database.pool` with
    parameterized SQL. `database.db` (Drizzle) only knows the project-owned
    `src/db/schema.ts`; generated resource tables are raw SQL and are **not** in that schema.
  - For a structured resource model, import the generated descriptor for the physical table and
    column names: `import qr from "../../generated/resources/qr.ts"`. Never derive SQL names from
    the API resource name.
  - Use `withTransaction(database.pool, async (client) => { ... })` from
    `@jeeves/postgres-runtime` when a handler must commit related rows atomically.
  - Owner extensions use `sessionPrincipal(request.request)` from `@jeeves/rest-server`, never an
    owner ID from the request body.
  - Use `publicOrigin()` from `@jeeves/rest-server` for the deployment public origin; it is
    validated at startup. Never read `process.env.PUBLIC_ORIGIN` in a feature.
  - Explain schema and migration changes in the postgres guide; generated resource migrations
    are generated-owned.
- **Tests:** `tests/*.test.ts`, run with `pnpm test`. `createService(service, { env, features,
  logger: false })` builds the service in-process; call it with `app.inject(...)`.
- **Dependencies:** add npm packages to this service's `package.json` with exact versions. A
  declared extension may already have its production dependency added by generation.

## Don't

- Don't edit `src/jeeves.generated.ts`, `docker-compose.yml`, or anything in `vendor/`. They're
  generated from the design and overwritten. Change the design and regenerate instead.
- Don't edit `src/generated/`, `resource-migrations/`, `contracts/<service>.openapi.yaml` when
  the service has a structured resource model, or any fixed acceptance test. Implement only the
  declared extension named by your task.
- Don't patch `@jeeves/service-runtime`. If it can't do something you need, say so in your report.
- Don't read `process.env` directly in features; declare `env` on the feature (or use the
  validated `publicOrigin()`).
- Don't use TypeScript syntax Node can't strip (enums, namespaces, parameter properties): the
  service runs its `.ts` sources directly. `pnpm typecheck` catches these.
- Don't log secrets or request bodies with personal data.

## Checks Jeeves runs

The container starts, `/health` is 200, `/ready` is 200 with dependencies up and 503 with one
stopped, a bad environment fails with a readable error, and SIGTERM shuts down cleanly within
`SHUTDOWN_TIMEOUT_MS`. Keep startup tasks and shutdown hooks quick so these keep passing.
