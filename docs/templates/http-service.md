# http-service

TypeScript HTTP microservice. The base element most other service templates build on.

## Board
Element, kind `service`. Card shows name, port, and attachment mini-boxes. Accepts attachments: `rest-api-server`, `rest-api-client`. Outgoing connection: `uses-database` to a `database` element.

## Config
- `port` (number, default 8080)
- `replicas` (number, default 1; local Docker only honors 1 unless scaled manually)
- `logLevel` (`debug` | `info` | `warn` | `error`, default `info`)

## Runtime package `@jeeves/service-runtime`
Fastify server bootstrap; environment config validated with Zod; pino logging; `/health` (liveness) and `/ready` (readiness: every declared dependency is reachable); graceful shutdown; `defineFeature()` plugin API through which project code registers routes, hooks, and startup tasks. Project code never edits the runtime.

## Scaffold (written once, then project-owned)
`package.json`, `tsconfig.json`, `Dockerfile`, `src/main.ts` (calls the runtime and registers features), `src/features/` (empty, for agents), `test/` (project-owned tests). Generated-owned: `src/jeeves.generated.ts` (wiring from connections and attachments).

## Connections
- `uses-database` → adds the database runtime plugin, `DATABASE_URL`, compose `depends_on` with a health condition.

## Test pack
Container starts; `/health` returns 200; `/ready` returns 200 with dependencies up and 503 with a dependency stopped; SIGTERM shuts down cleanly within the timeout; config validation rejects a bad environment with a readable error.

## Agent guide
Add behavior as features in `src/features/<name>/` registered through `defineFeature()`. Do not edit `jeeves.generated.ts` or the runtime package. Add tests in `test/`.

## Open questions
- Is Fastify the right base, or does the user prefer Hono or Express?
