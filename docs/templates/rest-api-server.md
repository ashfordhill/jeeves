# rest-api-server

Attachment that gives a service a contract-first REST API.

## Board
Mini-box on an `http-service` element. Has a handle that `calls` connections can target from a `rest-api-client` mini-box.

## Config
- `basePath` (default `/api`)
- `auth` (`none` | `bearer`, default `none`; `bearer` is a placeholder until an auth template exists)

## Runtime package `@jeeves/rest-server`
Loads `contracts/<service>.openapi.yaml`; validates requests and responses against it; serves `/openapi.json`; reports routes in the spec that have no handler.

## Scaffold
`contracts/<service>.openapi.yaml` with a placeholder `GET /ping` operation (project-owned; agents extend it), plus a matching handler in `src/features/ping/`.

## Connections
Target of `calls` from `rest-api-client`.

## Test pack
`/openapi.json` is served; every operation in the spec has a handler; contract-driven smoke tests (schema-valid responses for documented examples); invalid requests get 400 with a structured error.

## Agent guide
Change the OpenAPI file first, then implement handlers. Clients are regenerated from the spec, so breaking changes show up as client type errors.

## Open questions
- Which OpenAPI validation library to use (decide in S8; prefer a maintained MIT one, e.g. the Fastify ecosystem's).
