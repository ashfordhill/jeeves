# postgres

PostgreSQL database element.

## Board
Element, kind `database`. Target of `uses-database` from services. Several services can share one instance; each gets its own logical database and role.

## Config
- `version` (default: current stable major, pinned in S8)
- `logicalDatabases` (derived from incoming connections; read-only in the inspector)

## Runtime package `@jeeves/postgres-runtime`
Used by the consuming service: a connection pool (`pg`) with a budget, a readiness check, and a
migration runner (Drizzle migrations from the service's `migrations/` folder). It also exports
`withTransaction(pool, work)` for project-owned extension code and applies generated resource
migrations from the service's `resource-migrations/` folder under a transaction/advisory lock
before project-owned migrations.

## Scaffold
`databases/<id>/init/` SQL that creates one database and role per consuming service (generated-owned). In each consuming service: `src/db/schema.ts` and `migrations/` (project-owned). A structured service also gets generated resource descriptors under `src/generated/resources/` and immutable `resource-migrations/` files; use descriptor table/column names for raw SQL.

## Connections
Target of `uses-database`.

## Test pack
Container becomes healthy; each consuming service can connect only to its own database; migrations apply on a clean volume and are idempotent on restart; data survives `docker compose restart`.

## Open questions
- ~~Drizzle for template migrations, or node-pg-migrate?~~ Drizzle (S7), matching Jeeves's own stack.
