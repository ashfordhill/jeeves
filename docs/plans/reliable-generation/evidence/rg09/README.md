# RG09 — service identity and caller enforcement

Built on accepted RG08 `cbac7d80f9a6e8ce28c2832647f54c2088e1902a`. Extension API is **v8**:
the former unavailable HTTP dependency becomes a scoped `ServiceTarget.call(operation, request)`.
API7→8 requires explicit acknowledgement and a successful staged checker/TypeScript migration.
The updater refuses incompatible bodies without changing target bytes and never rewrites hooks.
Existing namespace/baseline guards remain effective with acknowledgement.

Server/worker modules select workload identity through the finite optional `workload` link.
The explicit source/blueprint tag preserves legacy untagged Identity links and permits distinct
user/workload links to the same issuer. Browser availability hides/refuses confidential workload
selection. An Auth guard's first Identity drag selects user identity; once filled, another drag
selects workload. Other supported module Identity dots select workload. The active stub-stack
migration uses Stats search itself and preserves the original business module/operation count.

Compiled process records contain stable issuer/client/audience identities, actual source-module
service links, offered operation IDs, user-forwarding requirements and maximum process callers.
Labels change none of those identities. Each route stub may export `allowedCallers` only to
narrow its maximum; empty denies all and a fabricated/duplicate caller refuses configuration.
Missing/mismatched setup refuses Preview/ZIP with a concrete fix, including Private network links.
Installed-template cross-process adapters remain explicit gaps. Legacy designs remain readable.

The supported wire is GET/POST at `/internal/modules/<stable-module-id>`, one existing stub
entrypoint per operation. GET has no body; both request path fields are `/`. Internal-only
callees expose no legacy `/modules` alias, wildcard or alternate-method bypass. Explicit public
ingress retains its user policy. Product handles fix destinations, operations, audiences and
credentials, forward no response headers and never follow redirects. JSON request/response DTOs
are bounded to 64 KiB, depth 16, 4,096 values, 1,024 array items, 128 object keys and 16 KiB/string.
Functions, getters, cycles, non-DTOs and oversized input refuse before credential/HTTP dispatch.
Primitive replies are JSON encoded, empty results normalize to null, and no-content replies stay
empty. Internal framing suppresses conflicting product length/encoding/cache headers and always
sets `Cache-Control: no-store`; automatic HEAD routes refuse before product dispatch. Public route
headers retain their behavior. No binary or general proxy is offered.

The finite local issuer profile is Keycloak **26.8.1** using RS256 confidential service accounts,
disabled user grants, a signed `jeeves_workload` process claim and matching dedicated `azp`, with
fixed service audiences. Mapper identifiers/configuration were checked against the pinned
[hardcoded-claim source](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/services/src/main/java/org/keycloak/protocol/oidc/mappers/HardcodedClaim.java)
and [audience source](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/services/src/main/java/org/keycloak/protocol/oidc/mappers/AudienceProtocolMapper.java).
Workload-marked tokens cannot establish end users, even with both audiences. An already verified
incoming bearer is propagated privately only to declared recipients sharing the user issuer and
is released on context close. No raw bearer reaches product DTOs. Session lookup, refresh,
cookies and refresh retries remain outside this adapter.

Each process snapshots its own credential/configuration before clients. Workload secrets use
`workload-jeeves-workload-<process-id>` through the existing private secret-file convention.
Issuer/token/JWKS endpoints are validated and obey `JEEVES_REQUIRE_TLS`. At most 16 target token
caches and one shared JWKS set exist per process. Token waits and each fetch/verification step
are bounded at 2 seconds; shared refresh is independent of one waiter's cancellation. Failed
refresh has a one-second cooldown. Tokens live only to verified exp, at most 300 seconds, with
early refresh in the last five seconds. A still-valid token survives refresh outage only within
that window. JWKS has at most 16 keys/64 KiB, 60-second maximum age and 30-second unknown-key
cooldown; outage never extends key validity. Cached validity also has a monotonic upper bound.
Invalid identity is safe 401, denied caller 403 and issuer/key outage 503, with no anonymous fallback.

GET is enforced as read on caller and callee. POST is an external mutation; timeout/loss,
oversized/invalid replies and remote uncertainty remain unknown, with no automatic replay.
The protected `X-Jeeves-Outcome` header survives custom error bodies. Actual emitted POST
execution followed by response-codec refusal produces `OUTCOME_UNKNOWN` through both services.
Local atomic effects prohibit network access even through nested reads. RG03 cancellation,
budget clamping and RG04 safe error/log behavior remain in force.

Keycloak startup import skips an existing realm; it is not a client updater.
[Official import behavior](https://www.keycloak.org/server/importExport) supports that limitation.
The local runner refuses missing/changed `.runtime/workload-contract.json` rather than silently
assuming new clients exist. The generated setup fixture executes in an in-memory filesystem and
checks service-only clients/mappers plus missing/changed setup refusal. A reviewed external
issuer migration or fresh disposable runtime is required; the local record is an operator
attestation, not issuer-state proof. No existing realm, secret or production endpoint was used.

| Check | Actual result |
| --- | --- |
| [Final `pnpm check`](check.txt) | Node 24.21.0; lint, workspace type checks, **127 files / 1,151 tests passed**. Existing `local.mjs` informational style suggestion only. |
| [Focused workload fixtures](focused.txt) | **65 passed** across workload/guard/process suites, including **16 workload cases** with actual emitted Fastify caller/callee, workload/user separation and confusion refusal, private alias/method closure, caller narrowing, DTO/wire framing, actual POST uncertainty, conflicting public response headers/no-store, authenticated HEAD refusal, independent caches, cancellation/budget/effect checks and setup behavior. |
| [Full browser suite](browser.txt), [targeted corrections](browser-targeted.txt) | **75 passed**, then the three failed exact connector-count/Identity-target expectations corrected and **3 passed**. All **78 cases** accounted for; TinyURL and both complete mouse rebuilds passed. No timeout or safety assertion weakened. |
| [Workload mouse paths](mouse.txt) | **2 passed**: workload-only missing-setup refusal→repair, plus Auth guard's second Identity drag; blueprint/source parity and project cleanup asserted. |
| [Build](build.txt), [final web test typecheck](web-typecheck.txt) | Passed; existing chunk-size warning only. |
| [Offline chat evals](offline-evals.txt) | Scripted good **100/100/100/100**, patterns **86.3/98.2/98.2**, bad **1.7/18.5/18.5/5**; twelve deterministic replay arms pass. Fetch is disabled; no live/paid model call. |
| [Scratch exports](emitted-compile.txt) | Ten variants pass emitted checker and TS7.0.2 offline: keys **53**, no-stub **74**, Favorites **73**, video **124**, workload-only **55**, workload+user **59**, migrated stubs **94**, frozen v2 **79**, module design off **86**, stub stack off **60**. Negative TS/private-import proof refuses token/audience/credential/header/raw-target access. |
| [Real pinned jose proof](real-jose.mjs) in [scratch output](emitted-compile.txt) | Actual emitted adapter with **jose 6.2.13**, ephemeral RSA keys and intercepted fetch: cached key during outage, key expiry, unknown-key/failed-refresh cooldown, rotation/recovery, twelve joined refresh waiters, separate cache instances, exp-bound token outage window and identity confusion/refusals pass. No live HTTP dispatch. |
| [Processes-off pin review](pins.json), [focused pin check](pins-check.txt) | **79→79 / 86→86 / 60→60**, no added/removed files. Changes are API8/compiled metadata/guide, optional workload slot comments/types, local issuer setup and private operation/identity/error behavior. Frozen v1 remains unchanged. |

The unit tests use a crypto-backed jose stand-in for HTTP fixtures and explicitly capture its
options; they do not claim to prove jose caching. The separate script above uses the actual
pinned library from an existing read-only dependency tree. Scratch exports use dependency
symlinks, no install, and are removed in `finally`. Native separate-process/Keycloak authentication
and concurrent migration/login proof remain RG14. There was no generated-system/Docker checkpoint.

Failures were diagnosed as stale exact outputs after selector/API changes, a narrow e2e helper
type, controlled-checkbox timing, and the Preview refusal response shape. Early scratch issues
were a missing user-verifier asset in the workload-only export and TypeScript narrowing in the
cache-validity helper. The eval runner's report flag was initially mistaken for an output flag;
the corrected plain offline command passes. Review corrections closed private aliases, bounded
DTO framing, separated user/service credentials, preserved POST uncertainty and tightened effect
inheritance. Assertions were retained and updated to the implemented contract. Final source review then suppressed
product framing/cache headers on internal replies, made no-store mandatory and refused Fastify
automatic HEAD dispatch; the affected 65 cases, ten scratch variants and full check passed again.
Browser/build/eval evidence is retained because those exercised paths did not change.

Seven root-file hashes and the exact **34,001-byte** owner diff/modes match the supplied receipts.
Frozen v1, historical exports/evidence, `.docs/`, feedback and root files are preserved. Docker
inventory remains only `c0fbbc2996fe jeeves-postgres-1` at loopback 54329. E2e uses 4301/4311 and
`jeeves_e2e`, deleting its own projects; owner 4300/4310 were untouched. No new provider/dependency,
secret inspection, cloud provisioning, native checkpoint, push, deployment or later unit occurred.
