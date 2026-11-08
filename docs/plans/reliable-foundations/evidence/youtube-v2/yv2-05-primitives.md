# YV2-05 runtime primitive evidence

This unit extracts completed repaired v1 transport mechanics into generic emitted TypeScript.
It installs dependency libraries only; no business template, runnable app shell or normal control
is attested. [Actual APIs/ownership](../../youtube-v2/interfaces.md#yv2-05--reusable-http-identity-and-transport-clients).
Raw logs and disposable exports are under `/tmp/jeeves-yv2-05/`; no credentials/tokens/media are
copied here. No v2 field app, v1 file, root README, provider pin or dependency lock changed.

## Standalone and offline checks

Two fresh assembly exports match every emitted path/hash. The full selection fixture emits
35 files, with eight actual helper assets and honest required application/mapping gaps.
Own frozen installation/build uses Node24.21.0/pnpm12.16.1 and the existing109 dependency packages.
No generator/workspace imports enter output. A smaller selected composition omits identity,
AMQP/delivery, objects and search helpers. The full frozen v1 108-path/hash list remains identical,
including manifest SHA `5098707958077ea90b4ad36118f987069351ace61b6f33251d347144f764e21f`.

Four offline root cases exercise the exact dependency-free emitted admission/delivery assets and
registry output: timed-out admission retention/drain; effect and terminal-confirm before ack;
retry exhaustion/fatal closure without self-await; selective helper emission without feature
installation. Invalid delivery bindings refuse before allocation. No Docker/network unit test
or comprehensive fault/load/certification matrix was added.

An initial standalone build caught Fastify's unknown error type and AWS credential narrowing;
both were corrected in the source assets before the passing fresh build. Failed logs are retained.

## Actual bounded HTTP/identity adapter smoke

`http-probe.mjs`, `http.log`, `http-summary.json`: actual emitted Fastify/jose modules listen only
on loopback45230 (service) and45231 (scratch JWKS). Both ports were closed after the probe.

Observed configure-before-listen, uninitialized503→ready200, safe unknown-error503,
unknown-route404/no-store and idempotent close. A locally signed RS256 token verifies through
an injected JOSE key set without a product role; wrong issuer/audience/algorithm refuse.
A separate remote JWKS request stays blocked beyond the handler deadline: response503 DEADLINE,
subsequent request503 OVERLOADED, then close remains pending until JWKS/handler work settles.
This checks actual awaited auth/dependency work inside the handler budget. It does not certify
Keycloak business-role/browser integration, which remains a later adapter responsibility.

## Actual bounded RabbitMQ adapter smoke and cleanup

Recorded **before startup** in `resources.json`: exact owned project
`jeeves-yv2-05-primitives`, HTTP/identity/object trio45230/45231/45232 and broker-only scratch
loopback45233. Namespace and ports were free. Only the emitted `local-broker` service ran,
using its unchanged pinned image and exact emitted username/secret; a disposable port override
allowed the host-side emitted-client probe. This was a direct broker adapter smoke, not a
foundation retained first-run/restart claim. Topology was asserted from the actual emitted plan;
no domain services or other providers started.

`broker-probe.mjs`, `broker.log`, `broker-summary.json` observe confirmed publish;
original delivery metadata; effect-gated close/ack; retry delivery counts1→2; awaited terminal
effect followed by confirmed failed-queue copy with stable message ID/terminal metadata;
and a failed terminal effect triggering exactly one fatal notification and completing drain
without self-await, leaving the original delivery unacked/requeued. Invalid queue binding rejects
before credential access/network allocation. No reconnect/exactly-once claim follows.

Scoped `docker compose --profile '*' ... down --volumes --remove-orphans` removed the exact
scratch container, broker volume and network. No scratch image was built. Private `.runtime`
was removed; `cleanup-summary.json` confirms no remaining project container/volume/network/image.
All fourteen owner v1 services remained healthy and their runtime/ports/volumes were preserved.
Jeeves/owner services and other Compose projects were not stopped/reset.

Required Jeeves suite results and final export logs are recorded in the unit handoff. No normal
studio UI changes; existing native browser E2Es retain TinyURL lane rendering and mouse actions.
