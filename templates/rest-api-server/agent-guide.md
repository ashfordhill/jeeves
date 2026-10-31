# Working with a rest-api-server attachment

The service serves a contract-first REST API with `@jeeves/rest-server`. The contract is
`contracts/<service>.openapi.yaml` (OpenAPI 3.1). Every operation in it becomes a route under the
attachment's base path; requests are validated before your handler runs and responses after.

## Two modes

**Legacy contract scaffold (no `config.model`).** The contract is project-owned. Change it first,
then implement handlers.

**Structured resource model (`config.model`).** Generation owns the contract, CRUD routes,
resource descriptors, migrations, generated tests, and fixed acceptance tests. Do **not** edit the
contract or any generated file, and do not add CRUD routes. Implement only the extension named by
your task in `src/features/<extension-id>/`.

For a structured service, read the generated resource descriptor for physical table/column names:

```ts
import { sessionPrincipal, publicOrigin } from "@jeeves/rest-server";
import { withTransaction } from "@jeeves/postgres-runtime";
import { defineFeature } from "@jeeves/service-runtime";
import { database } from "../../jeeves.generated.ts";
import qr from "../../generated/resources/qr.ts";
import scan from "../../generated/resources/scan.ts";

export default defineFeature({
  name: "redirect",
  operations: {
    followQr: async (request) => {
      const id = String(request.params.id);
      const [row] = (
        await database.pool.query(
          `SELECT "id", ${qr.fields.map((f) => `"${f.column}" AS "${f.name}"`).join(", ")} FROM "${qr.table}" WHERE id = $1`,
          [id],
        )
      ).rows;
      if (!row) return { status: 404, body: { error: "NOT_FOUND", message: "No such QR" } };
      await withTransaction(database.pool, async (client) => {
        await client.query(
          `INSERT INTO "${scan.table}" (id, "${scan.belongsTo[0]!.column}") VALUES (gen_random_uuid(), $1)`,
          [id],
        );
      });
      return {
        status: 302,
        headers: { location: String(row.destination), "cache-control": "no-store" },
      };
    },
  },
});
```

`sessionPrincipal`/`publicOrigin` are exported by `@jeeves/rest-server`. Use
`sessionPrincipal(request.request)` for owner identity and `publicOrigin()` for stable public URLs.
Use descriptors for names; never use the API resource name as a SQL identifier. The generated
contract documents standard error bodies, so return `{ error, message }` for 400/401/404 responses.

`sessionPrincipal(request.request)` returns `{ id, csrfToken }`; `principal.id` is the owner id.
Compare it with the resource's `owner_id` column (generated for owner resources) and never take the
owner from a request body or query.

### Owner commands and bounded settings

Structured extensions support GET reads and owner-only POST commands. A POST declares a required
`application/json` object body with `additionalProperties: false` in the design. Generation owns
the resulting contract and client types. The runtime checks the session, matching Origin and
CSRF token before dispatch, then validates the body without type coercion. Public POST commands
and GET request bodies are unsupported. Do not add undeclared routes to work around this boundary.

Owner access establishes a principal; the extension must still scope its query to the actual
owned resource. Put `owner_id = principal.id` in the mutation predicate (or join through its owned
parent), use parameterized values and return 404 when no owned row matches. Use a transaction for
related writes. Never accept a caller-supplied owner or replace a generated CRUD handler.

Resource fields can declare bounded `integer` values or finite `enum` tokens. Their JSON and SQL
constraints agree. Changing existing bounds or enum membership requires a reviewed migration;
changing names preserves stable physical IDs. A new optional field or a new resource is additive.
The widened descriptor surface uses `@jeeves/rest-server@0.2.0`; adopt that new artifact through
generation, preserving earlier pinned runtime artifacts and immutable migration history.

### Dates and binary bodies

- Postgres returns `date` and `timestamptz` columns as JavaScript `Date` objects. The response
  validator rejects a `Date` for a schema with `format: "date"`. Select text and aggregate in UTC:

  ```sql
  SELECT to_char(date_trunc('day', "occurred_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS "date",
         count(*)::int AS "count"
  FROM "scan" GROUP BY 1 ORDER BY 1
  ```

  `col::text` also works for a plain date column; always use `AT TIME ZONE 'UTC'` when truncating
  a timestamp.
- Binary responses: set `content-type` explicitly and return a `Buffer` as `body`. Fastify sends
  the bytes unchanged, and the response validator checks the PNG:

  ```ts
  return {
    status: 200,
    headers: { "content-type": "image/png", "content-disposition": `attachment; filename="${id}.png"` },
    body: png,
  };
  ```

  In a raw route added through `register(app)`, the equivalent Fastify reply is
  `reply.type("image/png").header("content-disposition", name).send(png)`.

- Fastify registers a HEAD route for every GET and calls the same handler. If a request must not
  count twice (the public redirect inserts a scan), check `request.request.method` and skip the
  insert for HEAD; never assume only GET reaches the handler.

## How to add or change an operation (legacy mode)

1. **Change the contract first.** Add the path and method with a unique `operationId`, its
   parameters, request body, and every response it can return (including 4xx), each with a
   JSON schema. Reuse `components/schemas`. Add `example` values for parameters and bodies:
   Jeeves calls `GET` operations with them, and others that set `x-jeeves-smoke: true`.
2. **Implement the handler** in a feature, keyed by `operationId`:

   ```ts
   import { defineFeature } from "@jeeves/service-runtime";

   export default defineFeature({
     name: "links",
     operations: {
       getLink: async ({ params }) => {
         const link = await findLink(String(params.code));
         return link
           ? { status: 200, body: link }
           : { status: 404, body: { error: "NOT_FOUND", message: "No such link" } };
       },
     },
   });
   ```

   `params`, `query`, `headers`, and `body` are already validated (and query and path values
   coerced to their schema types). Return `{ status, body?, headers? }`.
3. **Test it** in the service's `tests/` folder with `app.inject`.

Clients are generated from the contract, so a breaking change shows up as type errors in the
services and frontends that call this API. Prefer adding fields and operations to changing or
removing them.

## What the API does for you

- 400 `REQUEST_INVALID` with `details: [{ in, path, message }]` for requests that break the
  contract; 404 `NOT_FOUND` for unknown paths under the base path.
- 501 `NOT_IMPLEMENTED` for operations with no handler (listed at startup and at
  `/_jeeves/operations`). A handler for an operation that isn't in the contract stops startup.
- 500 `RESPONSE_INVALID` when a handler returns an undocumented status or a body that doesn't
  match its schema. Fix the handler or the contract, whichever is wrong. Use a JSON
  `{ error, message }` body for standard 400/401/404 statuses.
- `/openapi.json` serves the contract.

## Don't

- Don't register API routes by hand with `app.get(...)` under the base path; put them in the
  contract (legacy) or in the declared extension.
- Don't edit `src/jeeves.generated.ts`, `docker-compose.yml`, `src/generated/`, resource
  migrations, fixed acceptance tests, or `@jeeves/rest-server`.
- Don't rely on `auth: bearer` for real security: it's one shared local token. Structured services
  select `auth: session` and get opaque server-side sessions and CSRF checks.

## Checks Jeeves runs

`/openapi.json` serves the contract, every operation has a handler, examples get schema-valid
responses, and invalid requests get a structured 400. Structured services additionally run
independent owner-isolation and fixed acceptance suites.
