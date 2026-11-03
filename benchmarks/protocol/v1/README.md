# Independent benchmark protocol v1

P61a supplies shared contracts and fixture validation. The three application contracts and concrete
observations belong to **P61b (Discourse), P61c (Vendure), and P61d (Zammad)**. Parent P61 remains
incomplete. No application, provider, HTTP adapter, fixture-control server or runner exists here.
No benchmark pass or implementation point follows from parsing these files.

The [shared protocol rules](../../../docs/plans/backend-benchmarks/benchmarks.md#2-common-protocol-and-fixture-rules)
and [command trace](../../../docs/plans/backend-benchmarks/worked-trace.md) supply the semantics.
[components.openapi.json](components.openapi.json) is a portable OpenAPI 3.1 document with shared
components and an empty `paths` object. It is an independently authored contract snapshot, exported
from [benchmark-protocol.ts](../../../packages/spec/src/benchmark-protocol.ts); tests check equality.
It does not describe upstream APIs or current legacy runtime responses. Each application child
supplies its own `contracts.openapi.yaml`, routes, operation IDs, security scheme and concrete data.
Reference shared components with a relative OpenAPI `$ref`; bind the exact exported schemas in
contract-only tests. Do not read implementation descriptors to construct expectations.

## Wire protocol

| Outcome | HTTP status | Common code |
| --- | ---: | --- |
| Malformed/unknown writable fields, invalid bounds | 400 | `INVALID_INPUT` |
| Invalid, tampered, foreign or query-mismatched cursor | 400 | `INVALID_CURSOR` |
| Missing, forged, expired, logged-out or foreign application session | 401 | `UNAUTHENTICATED` |
| Known readable object with forbidden action; failed Origin/CSRF | 403 | `FORBIDDEN` |
| Missing or inaccessible object lookup | 404 | `NOT_FOUND` |
| Stale aggregate version | 409 | `VERSION_CONFLICT` |
| Committed command key reused with changed normalized input | 409 | `IDEMPOTENCY_CONFLICT` |
| Same command still executing; safe same-key retry | 409 | `COMMAND_IN_PROGRESS` |
| Valid input rejected by a domain invariant | 422 | `DOMAIN_REJECTED` |
| Required hook is unavailable, before domain mutation | 503 | `HOOK_UNAVAILABLE` |
| Declared dependency unavailable; outcome may need reconciliation | 503 | `DEPENDENCY_UNAVAILABLE` |

Each operation lists its applicable statuses. Additional safe domain codes must be declared in its
independent `errorCodes` map; they cannot override a common code's status. Do not turn a failure into
HTTP 200. No hook success is inferred from its unavailable response. An infrastructure timeout
never proves rollback or authorizes another payment attempt with a new key.

Errors are strict `{code, message, correlationId, fieldErrors?}` objects. Codes are at most 64
uppercase ASCII letters/digits/underscores; safe messages at most 300 characters. Optional field
errors have 1–20 entries, each with `field` and safe `message` of at most 160 characters. Never put
private titles, credentials, SQL, stack traces or existence/membership details in these fields.
An error's `correlationId` equals its `X-Correlation-Id` response header. The server establishes a
bounded correlation token; a client-supplied value does not establish authority.

All responses carry `Cache-Control: no-store` and `X-Correlation-Id`. JSON responses use
`Content-Type: application/json`; property order is immaterial. Each operation fixes its success
status, body and additional headers. A 204 has no body or content type; bytes use an explicit MIME
and bounded fixture-file descriptor, with byte/hash assertions in test support. Session responses
add `Set-Cookie`; commands that return `COMMAND_IN_PROGRESS` declare `Retry-After: 1` (seconds).
Header keys in fixture JSON are lowercase; actual HTTP names are case insensitive. CR/LF in header
values is rejected. Additional success headers are validated by status-specific `responseHeaders`.

## Sessions and authority

Reuse the existing [session contracts](../../../packages/spec/src/resources.ts) and
[session implementation boundary](../../../templates/rest-api-server/runtime/src/sessions.ts).
Credentials are strict email/password (12–128 characters), never a role/bootstrap field. Session
identity is `{id, csrfToken}`. The server generates an opaque token, stores only its hash with the
principal, CSRF token and seven-day expiry, and survives API restarts. Logout invalidates the stored
session. Public account creation cannot promote its caller. Privilege bootstrap is an operator
operation; test-role seeding is confined to the disposable fixture adapter.

For each application origin, reuse `jeeves_session_` plus the first 32 lowercase hex characters of
SHA-256 of the normalized configured origin. Cookie attributes are `HttpOnly; SameSite=Strict;
Path=/; Max-Age=604800`, plus `Secure` for HTTPS. Logout clears it with Max-Age 0. Origins/credentials
are isolated per application. `benchmarkSessionSecurityScheme(cookieName)` binds the real cookie
name in that application's OpenAPI; a shared hardcoded cookie name would defeat isolation.

Session mutations require the exact configured `Origin` and server-issued `X-CSRF-Token` for that
session. Register/login require the same exact Origin, without an existing session CSRF token.
Every route chooses public, session or authenticated-provider access explicitly. Body scope IDs,
route IDs, raw roles and queue payloads remain references to authorize. Recheck current scope,
membership, action and field projection before reads, writes and receipt replay. A route-level
authorization check cannot replace checks before private bytes, search/counts or worker effects.
Provider callbacks verify original bytes and the adapter's timestamp/signature/replay contract;
they do not substitute user cookies or a fixture bypass in the production API.

## Paging and command replay

A page is strict `{items, nextCursor}` with at most 100 items and a nullable next cursor; no
unscoped total/count is implicitly supplied. `limit` defaults to 25, accepts integers 1–100 and
rejects unknown query fields. HTTP adapters convert query text to these logical values explicitly;
the contract validator does not coerce them. Each operation fixes keyset ordering with an ID tie
breaker. Cursor transport is nonempty base64url text of at most 2048 characters. This lexical
schema does **not** authenticate a cursor. The server validates its version/integrity, selected
scope, query/filter/order and last tuple; current authorization applies before every page,
count/snippet or aggregate. A cursor cannot preserve revoked access. Application fixtures must
interleave inaccessible rows across pages and assert their absence.

Mutating domain commands use `Idempotency-Key`: 1–128 ASCII letters/digits/`.`/`_`/`:`/`-`, starting
with a letter or digit. An aggregate mutation also supplies a positive safe-integer
`expectedVersion` where relevant. Command identity includes application profile/version, exact
operation, validated scope, authenticated principal and key. Keys from another principal, scope,
operation or application never identify the same command. Provider events use their separately
declared authenticated event/receipt identity.

Hash strict validated input canonically: sorted object keys, preserved array order, explicit
normalized route/query/body including expectedVersion. Header order, correlation IDs and session
secrets are not command input. Persist domain changes, required audit/outbox intent, normalized
input hash and terminal result together. Same-key/same-input replay returns the original permitted
status/body after current authorization; changed input returns 409 without mutation. A replay
checks its receipt before applying expectedVersion to a new mutation. A transaction failure leaves
no successful receipt. Concurrent identical calls produce one mutation; an in-progress caller may
receive declared 409/Retry-After and retries the **same** key.

The replay window is **604800 seconds (seven days)** after commit. Cleanup is explicit; do not
promise eternal deduplication after expiry. Response loss leaves commit unknown to the caller;
only retry/reconciliation establishes its outcome. Database command receipts, worker effect
receipts and external-provider deduplication are distinct contracts.

## Fixture and adapter boundary

[benchmark-fixtures.ts](../../../packages/spec/src/benchmark-fixtures.ts) defines strict, bounded,
JSON-serializable fixture packs and `parseBenchmarkFixture(input, independentContract, ledger)`.
The independent contract supplies Zod request/success schemas, declared errors, dataset row
schemas and fixture-control input/output schemas. Keep every writable object strict. Export those
same acceptance-side schemas into the application's OpenAPI and test their equality; do not
maintain a more permissive copy or import schemas/evaluators from the runtime under test.

A real application pack binds both P59 ledger hashes, profile/version, fixture version and seed.
Parsing revalidates canonical pins, exact mandatory observation/case membership and nonempty
operation/scenario references. Duplicate identities, equivalent parameterized routes, unknown
operations/actors/controls, orphan requests, missing observations, invalid expected payloads and
contradictory literal assertions are errors. Real packs require two isolated scopes, at least two
ordinary principals, one privileged principal, one revoked principal and an anonymous actor.
Dataset schemas independently validate initial rows. Bounds are eight JSON nesting levels, 100
keys/object, 1000 array items and 65536 characters/string; large byte fixtures use files/descriptors.

Each scenario starts from the declared dataset/seed and runs its steps in order. `request` steps
refer to fixed request samples; `parallel` steps name a bounded request group with a barrier in
test support. Request samples explicitly distinguish valid input from intentional malformed input
(which must fail its schema and expect HTTP 400). Expected responses include fixed status/body/
headers, or `{outcome: "connection-lost"}` without pretending to know the commit result. Literal
`equals` and `absent` assertions address body fields by bounded path segments, or each request ID
inside a parallel group. They are data, never executable expressions. Subsequent test-support
inspection asserts authoritative counts, versions, events and forbidden state.

`control` steps name an independently registered worker, fault, clock, provider or inspection
control and have typed input/expected output plus literal assertions. The future test adapter owns
reset/seeding, local-only credentials/session establishment, deterministic clock/ID factories,
barriers, faults, worker restart/drain and privileged invariant inspection. Fixed UUID/time values
are fixture values; where real output varies, bind/compare meaningful identities in test support.
No control is an application OpenAPI route. No production authentication bypass is supplied.
Provider/file/mail fixtures use loopback services and fixture-only credentials; no live account
is needed. App-specific failure points and full expected outcomes remain P61b–d work.

[synthetic.json](synthetic.json) contains four **T-prefixed** observations over illustrative token
creation/replay/paging and one inspection control. Its literal count of one is an expectation,
not an observation of a running app. Its executable contract is isolated in
[the contract tests](../../../packages/spec/src/benchmark-fixtures.test.ts). The synthetic profile
cannot bind any scored ledger. `benchmarkFixtureUnavailable(pack, "not-run" | "blocked", reason)`
returns explicit per-observation absence with a nonempty reason, no points and no pass option.
Actual D/V/Z applications remain absent/not run. New execution belongs to P74/P79.

## Fixed acceptance identities

After full fixture validation, `backendAcceptanceCatalog(pack)` supplies an explicit service-scoped
registration. Behaviors are `backend:<profile>:<version>:<operationId>`; acceptance references are
exact frozen observation IDs with their case owner. This is a declaration, never evidence or
implementation availability. The existing generator acceptance helpers accept an optional backend
catalog map in addition to resource and delivery models. Unregistered service/behavior/version,
foreign observation, missing operation/case coverage and duplicate suite/behavior/reference
identities are rejected/reported. An observation spanning multiple operations needs coverage for
each declared pair. Multiple distinct suites may intentionally exercise the same observation.

Backend-only suites cannot claim legacy resource acceptance references. Resource extensions and
`event:<attachment>:<event>` behaviors retain their ownership and coverage rules; neither a backend
registration nor a matching string from another service satisfies them. Files emitted through the
existing helper keep generated ownership. No new `requires`/runner mode, generation registration,
or orchestration dispatch is introduced. P74/P79 must integrate the committed catalog and provide
real independent execution before producing any scored evidence.
