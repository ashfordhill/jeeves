# rest-api-server

Attachment that gives a service a contract-first REST API.

## Board
Mini-box on an `http-service` element. Has a handle that `calls` connections can target from a `rest-api-client` mini-box.

## Config
- `basePath` (default `/api`)
- `auth` (`none` | `bearer` | `session`; `bearer` is a legacy shared local token. `session` adds
  generated accounts, opaque server-side sessions, HttpOnly cookies and CSRF checks.)
- `model` (optional structured resource model: resources, acceptance cases, extensions, fixed
  OpenAPI extension contracts, and exact extension dependencies)

## Runtime package `@jeeves/rest-server`
Loads `contracts/<service>.openapi.yaml`; validates requests and responses against it; serves
`/openapi.json`; reports routes in the spec that have no handler. For a structured model it also
registers generated session, owner-scoped CRUD and extension routes, and exports
`sessionPrincipal(request)` and `publicOrigin()` to project-owned extensions.

## Scaffold
- **Legacy (no model):** `contracts/<service>.openapi.yaml` with a placeholder `GET /ping`
  operation (project-owned; agents extend it), plus a matching handler in `src/features/ping/`.
- **Structured model:** the contract, `src/generated/**`, `resource-migrations/**`,
  `tests/generated/**` and `tests/acceptance/**` are generated-owned. Each extension is
  scaffolded once at `src/features/<extension-id>/` and stays project-owned.

## Connections
Target of `calls` from `rest-api-client`.

## Test pack
`/openapi.json` is served; every operation in the spec has a handler; contract-driven smoke tests
(schema-valid responses for documented examples); invalid requests get 400 with a structured
error. Structured services run independent session/CRUD and fixed acceptance suites in a
disposable fixture.

## Agent guide
Without a model, change the OpenAPI file first, then implement handlers. With a model, implement
only the declared extension; never edit the contract or generated files. Clients are regenerated
from the spec, so breaking changes show up as client type errors.

## Open questions
- ~~Which OpenAPI validation library to use?~~ Ajv 2020 (MIT) directly, with a small contract loader in `@jeeves/rest-server` (S8). `fastify-openapi-glue` only validates responses by serializing them, and the brief asks for real response validation.
