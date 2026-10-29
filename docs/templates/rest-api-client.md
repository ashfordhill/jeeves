# rest-api-client

Attachment that gives a service or frontend a typed client for another service's REST API.

## Board
Mini-box on an `http-service` or `web-app` element. A `calls` arrow from this mini-box to a `rest-api-server` mini-box picks the target.

## Config
- `timeoutMs` (default 5000)
- `retries` (default 0)

## Runtime package `@jeeves/rest-client`
Thin wrapper over `openapi-fetch` with timeouts, retries, and request-ID propagation. Types come from `openapi-typescript`, generated from the target's contract.

## Scaffold
Generated-owned: `src/clients/<target>.generated.ts` (types plus a configured client). Base URL comes from an environment variable set in compose.

## Connections
Source of `calls` → `rest-api-server`. Unconnected → readiness finding.

## Test pack
The generated client type-checks against the target spec; a call to the target's `/ping` succeeds inside compose; a timeout surfaces as a typed error.

## Open questions
None yet.
