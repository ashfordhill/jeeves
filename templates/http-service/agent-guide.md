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
- **Database** (when the design connects one): `import { database } from "../../jeeves.generated.ts"`
  and query `database.db` (Drizzle). See the postgres guide for schema and migrations.
- **Tests:** `test/*.test.ts`, run with `pnpm test`. `createService(service, { env, features,
  logger: false })` builds the service in-process; call it with `app.inject(...)`.
- **Dependencies:** add npm packages to this service's `package.json` with exact versions.

## Don't

- Don't edit `src/jeeves.generated.ts`, `docker-compose.yml`, or anything in `vendor/`. They're
  generated from the design and overwritten. Change the design and regenerate instead.
- Don't patch `@jeeves/service-runtime`. If it can't do something you need, say so in your report.
- Don't read `process.env` directly in features; declare `env` on the feature.
- Don't use TypeScript syntax Node can't strip (enums, namespaces, parameter properties): the
  service runs its `.ts` sources directly. `pnpm typecheck` catches these.
- Don't log secrets or request bodies with personal data.

## Checks Jeeves runs

The container starts, `/health` is 200, `/ready` is 200 with dependencies up and 503 with one
stopped, a bad environment fails with a readable error, and SIGTERM shuts down cleanly within
`SHUTDOWN_TIMEOUT_MS`. Keep startup tasks and shutdown hooks quick so these keep passing.
