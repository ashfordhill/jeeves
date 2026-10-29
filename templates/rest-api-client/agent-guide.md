# Working with a rest-api-client attachment

This element calls another service's REST API through a typed client. The client is generated
from the design (`src/clients/<target>.generated.ts`, exported as `<target>Client`), and its
types come from the target's contract (`contracts/<target>.openapi.yaml`).

## Calling the API

```ts
import { linksClient } from "../../clients/links.generated.ts";

const { data, error, response } = await linksClient.GET("/links/{code}", {
  params: { path: { code } },
});
if (error) {
  // A documented error status: `error` is typed from the contract (e.g. NOT_FOUND).
}
```

- Paths, parameters, bodies, and responses are typed from the contract, relative to the
  target API's base path. An error status comes back as `{ error, response }`; it isn't thrown.
- A call that gets no response throws a `RestClientError` (import it from `@jeeves/rest-client`)
  with `code` `TIMEOUT` (no answer within the attachment's `timeoutMs`) or `NETWORK`. Handle it
  where a failed dependency should degrade gracefully instead of failing the whole request.
- Idempotent calls (GET, HEAD, OPTIONS, PUT, DELETE) are retried `retries` times after a
  timeout, a network error, or a 502/503/504. POST and PATCH never are.
- **In a service**, calls made while handling a request forward its `x-request-id`, so one ID
  follows a request across services in the logs. The address and token come from
  `API_<TARGET>_URL` and `API_<TARGET>_TOKEN`, set by docker-compose.yml and checked at startup.
- **In a web app**, the client calls the API through the app's own server
  (`/_api/<target>/...`, proxied by nginx, which also adds the bearer token). Get clients from
  `useApis()` in components so tests can pass fakes through `<JeevesProvider apis={...}>`.

## When the contract changes

`npm run typecheck` (or `pnpm typecheck`) first regenerates `src/clients/<target>.openapi.ts`
from the contract (its `pretypecheck` script runs `jeeves-rest-client-types`), then type-checks.
After the target's contract changes, run it: calls that no longer match show up as type errors.
If the operation you need isn't in the contract, add it to the contract (and implement it in the
target service) rather than calling an undocumented path.

## Don't

- Don't edit `src/clients/*.generated.ts` or `src/clients/*.openapi.ts`; both are regenerated.
- Don't build URLs to other services by hand or call them with plain `fetch`; use the client.
- Don't read `API_*` variables yourself or hard-code service addresses.

## Checks Jeeves runs

The generated client type-checks against the target's contract, a documented GET (`/ping` when
there is one) succeeds through the client inside compose, and a call that gets no answer fails
with a typed timeout error.
