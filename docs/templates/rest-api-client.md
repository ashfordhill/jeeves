# rest-api-client

Attachment that gives a service or frontend a typed client for another service's REST API.

## Board
Mini-box on an `http-service` or `web-app` element. A `calls` connection from the outer element selects this client capability on one end and the REST API server capability on the other.

## Config
- `timeoutMs` (default 5000)
- `retries` (default 0)

## Runtime package `@jeeves/rest-client`
Thin wrapper over `openapi-fetch` with timeouts, retries, and request-ID propagation. Types are generated from the target's contract in the shape `openapi-typescript` emits, by the runtime's own `jeeves-rest-client-types` (S9): openapi-typescript needs the TypeScript 5 compiler API, and generated projects use TypeScript 7, which has none. `npm run typecheck` regenerates them first (`pretypecheck`).

## Scaffold
Generated-owned: `src/clients/<target>.generated.ts` (types plus a configured client). Base URL comes from an environment variable set in compose. For a structured resource target, the contract is generated-owned too; do not add operations to it. Binary operations use `parseAs: "blob"`.

## Connections
Source of `calls` → `rest-api-server`. Unconnected → readiness finding.

## Test pack
The generated client type-checks against the target spec; a call to the target's `/ping` succeeds inside compose; a timeout surfaces as a typed error.

## Open questions
None yet.
