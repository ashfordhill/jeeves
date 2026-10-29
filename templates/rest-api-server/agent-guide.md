# Working with a rest-api-server attachment

The service serves a contract-first REST API with `@jeeves/rest-server`. The contract is
`contracts/<service>.openapi.yaml` (OpenAPI 3.1, project-owned). Every operation in it becomes a
route under the attachment's base path; requests are validated before your handler runs and
responses after.

## How to add or change an operation

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
3. **Test it** in the service's `test/` folder with `app.inject`.

Clients are generated from the contract, so a breaking change shows up as type errors in the
services and frontends that call this API. Prefer adding fields and operations to changing or
removing them.

## What the API does for you

- 400 `REQUEST_INVALID` with `details: [{ in, path, message }]` for requests that break the
  contract; 404 `NOT_FOUND` for unknown paths under the base path.
- 501 `NOT_IMPLEMENTED` for operations with no handler (listed at startup and at
  `/_jeeves/operations`). A handler for an operation that isn't in the contract stops startup.
- 500 `RESPONSE_INVALID` when a handler returns an undocumented status or a body that doesn't
  match its schema. Fix the handler or the contract, whichever is wrong.
- `/openapi.json` serves the contract.

## Don't

- Don't register API routes by hand with `app.get(...)` under the base path; put them in the
  contract.
- Don't edit `src/jeeves.generated.ts`, `docker-compose.yml`, or `@jeeves/rest-server`.
- Don't rely on `auth: bearer` for real security: it's one shared local token until an auth
  template exists.

## Checks Jeeves runs

`/openapi.json` serves the contract, every operation has a handler, examples get schema-valid
responses, and invalid requests get a structured 400.
