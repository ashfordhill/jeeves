# RG19 — browser sign-in, sessions and CSRF

Implemented on accepted RG18 `ba89ff12822a1e3d07bfe62666e6008a52193d5c`, in the primary main
checkout. Pending coordinator acceptance. No later unit, native generated-system matrix, live
issuer/cloud/paid call, owner studio/database, root edit, push or deployment.

[Exact contract/configuration](protocol.md), [primary pinned API review](primary-api.md),
[dependency receipt](oidc-pin.json) and [actual library proof](protocol-final.txt).

The Service-only Browser session lead binds selected Keycloak Identity and writable owned state.
Its five finite settings reach schema/form/normal validation/chat/blueprint/emission together.
Protected append-only054 owns login/session state under precise framework grants; product-only
credentials cannot access it. Existing050–053/counter SQL builders are unchanged. One-use code+
PKCE/state/nonce/browser binding, sealed issuer material, fresh flagged cookies, relative return
paths, CSRF/guest facts, local logout, idle/absolute expiry and owning-service subject revocation
are generated. Existing immutable caller DTOs carry facts only. Supplied invalid identity always
refuses; cookieless Optional calls remain anonymous. A cookieless logout cannot clear omitted Lax
cookies. Common HTTP security headers/status/cookie clears survive product error-body formatting.

Compiled namespaces include selected Identity; protected rows/private seals bind exact issuer and
client authority as well. Retained cookies/transactions cannot authenticate after an authority
change. Subject revocation covers all authority versions within the compiled namespace. Identity
link migration requires draining/revoking the old compiled scope first. Startup checks every
required privilege individually. Store-time expiry/revocation is irreversible; no clock-return
concession or production insecure TLS switch exists.

Bearer guards, webhook ingress, existing JWT-only Required-user templates (Favorites, limiter,
multipart) and session service forwarding explicitly refuse. Refresh remains unavailable.
Offline-access enabled requests/stores material only. The export honestly reports required trusted
HTTPS and exact confidential-client/callback registration against the selected Keycloak realm;
plain-HTTP local defaults do not provide secure sessions. Native local issuer/inter-process proof
remains at the later assigned checkpoint.

Verification:

- [Final pnpm check](check-authority.txt): **143 files /1305 tests**, lint and all workspace types
  pass. [Focused authority/grants](authority-complete.txt):26/26. [Browser/chat parity](focused-final.txt):
  26/26 at its earlier22-browser-case stage. [Docker manifest/runtime focus](focused-dockerfile.txt):
  33/33. SQL/role tests observe real PGlite transactions, state/binding reuse, fixation, expiry,
  logout, optional/required identity, guest/session CSRF, malicious body formatter, private token
  exclusion, retained/current/removed ring keys, wrong authority, old transaction refusal and
  SELECT-only startup refusal. Workspace unit tests do not install OIDC or require network/Docker.
- [Actual exported-project compile](compile-final.txt), [runner](compile.ts):67 files with a custom
  product route. [Standalone Browser-only compile](standalone-complete.txt), [runner](standalone.ts):
  64 files. Both actual extension checkers and pinned TypeScript7.0.2 builds pass; exact paths and
  direct dependency pins are printed. The real checker refuses product session-runtime imports.
  Generated package/lock/workspace only pin openid-client6.8.9, reuse JOSE6.2.13 and lock
  oauth4webapi3.8.8; Docker copies that workspace policy before frozen install. Root pins unchanged.
- [Actual OIDC protocol proof](protocol-final.txt), [runner](protocol.mjs): emitted adapter plus
  actual pinned library with signed RS256 tokens and HTTPS fetch stand-ins. Valid code/state/
  nonce/PKCE succeeds; state mismatch avoids token POST; nonce/PKCE/signature/issuer/audience/
  expiry/bounded-subject/workload mismatch refuses. Startup outage and256KiB streaming response
  bounds refuse. Token network/503/429/malformed error body/invalid-client/malformed-JWKS failures
  remain dependency/unknown, never401 or anonymous. Forty cancelled pre-dispatch reservations
  release. Deterministic gated32 actual pending token POSTs retain capacity after cancellation;
  no33rd dispatch and no blind grant retry. These are protocol stand-ins, not native issuer proof.
- [Full browser](e2e.txt): **86/86**, including both long rebuilds, TinyURL and the new session
  controls/refusal/blueprint/export case. [Final source mouse](mouse-final.txt):1/1 after authority
  fixes. Screenshot uses testInfo.outputPath, with the selected image copied explicitly only into
  [RG19 evidence](mouse-browser-session.png). [Web build](build.txt) and plain [offline chat](offline-chat.txt)
  pass; scripted/synthetic replay is control parity, not live model-quality evidence.
- [Reviewed processes-off pins](pins-complete.txt), [bounded updater](pins.ts):80/87/60 files,
  unchanged paths. Changes are the generated dependency assets/Docker copy, private browser
  credential reader, common referrer header, extension guide and manifest hashes. No old saved
  source/export, frozen v1 or historical evidence was rewritten.
- [Preservation](preservation-final.txt), [reproducible comparison](preservation.py),
  [container triples](docker-after.json): six original non-README root hashes, continuing owner
  README, exact original28-path owner patch under its archive remapping, all42 original container
  IDs/names/states, applied050–053 and counter/receipt SQL builders, frozen v1 match.
  [RG19 project cleanup](project-cleanup.txt) is zero. Owner files/modes are excluded from staging.

Failure history is retained. Initial wiring used a nonexistent registry method/source metadata
field and omitted component selectors; corrected tests retain all behavioral assertions. Early
scratch invocations found runner-path/directory, generated import/type and lock-policy issues;
corrected actual exports above pass. Initial isolated `--ignore-workspace` install ignored the
existing protobuf build policy; final isolated normal install uses that generated policy and exact
scoped overrides. Initial protocol cancellation test was replaced with deterministic admission
before cancellation, keeping actual pending-count/refusal assertions. The first standalone runner
needed its new application-owned hook directory before testing the import refusal; final proof
passes. Initial full check had reviewed catalog/count/menu/pin expectations; a subsequent full
check1300/1301 exposed only the second exact Docker COPY oracle, then passed143/1301 before final
authority tests. Test-only row typing cleanup and this unit's own inventory formatting failures
were corrected without changing assertions. Final authority full check above is143/1305 green.

Own logs sanitize enormous data-URL addresses only where present and retain failure locations and
assertions. The final check log notes16 NUL padding bytes removed after a concurrent whitespace
rewrite; result/assertion text is preserved. Earlier accepted evidence was not edited. Cleanup
throughput, indefinite replay, issuer-wide logout, permanent user bans, hostile-code isolation,
production TLS provisioning, native competing-process behavior and refresh/forwarding are not claimed.
