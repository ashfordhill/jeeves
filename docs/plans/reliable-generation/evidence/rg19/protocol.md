# Browser session contract

Browser session is Service-only, one authority per host, with declared writable PostgreSQL state
and the selected installed Keycloak Identity. Runnable processes are required. Schema054 is
append-only; applied050/051/052/053 and counter100 remain unchanged. Exact framework grants go
to the owning process; product-only roles and a co-owner Worker have no session-table authority.

Five normal choices reach mouse, chat, blueprint and generation: required/optional sign-in,
idle60–86400s, absolute60–604800s (idle<=absolute), guest context and offline-access request.
Defaults are optional/86400/604800/disabled/disabled. Existing JWT-only required-user templates
(Favorites, limiter, multipart), bearer Auth guards and webhook ingress refuse this host pairing.
Session service forwarding and refresh remain unavailable. Sealed access/refresh/ID tokens are
private storage only; local session identity is independent of issuer access-token expiry.

The exact emitted guide `.jeeves/extensions.md` documents generated route paths, private secret
filenames, compiled client and selected-realm configuration. For the fixture, issuer variable is
`JEEVES_BROWSER_IDENTITY_IDENTITY_ISSUER` and must be HTTPS with exact `/realms/identity` path.
Client is compiled `jeeves-browser-browser-api-sign-in`; register confidential authorization-code
flow, S256 and exact HTTPS callback. `JEEVES_BROWSER_SIGN_IN_CALLBACK` supplies its external
URL (including edge prefix), ending `/modules/sign-in/callback`. A single optional bounded
`JEEVES_BROWSER_SIGN_IN_AUDIENCE` is the only extra authorization parameter. Offline-access enabled
adds that scope. There is no arbitrary authorization URL map. This registration and trusted HTTPS
are an explicit required export integration gap: generated plain-HTTP local defaults do not supply
secure browser sessions. No provider substitution or production insecure/test-clock override.

Private client secret file is `SECRET_DIR/jeeves-browser-sign-in-client-secret`; ring file is
`SECRET_DIR/jeeves-browser-sign-in-keys` (`SECRET_DIR=/run/secrets` by default). Absolute-path
`JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_CLIENT_SECRET_FILE` and
`JEEVES_SECRET_JEEVES_BROWSER_SIGN_IN_KEYS_FILE` overrides follow RG08. Ring reads retain its
64KiB/1..8-key bounds, private HKDF purposes and authenticated scope/context binding. Current keys
write; retained keys read; removed sealing keys invalidate old sessions. Keys/tokens/cookies never
enter product dependencies or logs. Configuration is validated before opening any client.

GET `/modules/<lead>/login` accepts only one safe relative `returnTo` (<=1024 UTF8 bytes), generates
256-bit state/nonce/PKCE verifier/browser binding, persists the sealed ten-minute transaction and
redirects. Unsafe relative-path normalization/encoding, absolute URLs, protocol-relative paths,
controls and duplicate/unknown query parameters refuse. GET `/callback` consumes the matching
unexpired transaction atomically before one code exchange. Reuse/expired/wrong-browser/state/
nonce/PKCE/issuer/audience/expiry/signature mismatch refuse. A fresh session cookie always replaces
and atomically revokes the supplied previous session; there is no chosen-session-ID input.

`openid-client`6.8.9 performs discovery, code-grant and RS256 ID-token verification, including
signature checks. TLS is mandatory. Transport and whole SDK calls have fixed3s bounds; each
response stream is capped256KiB. The32-slot cap follows actual pending promises after caller
timeout, not the caller's returned race. Token POST timeout is unknown, never an authorized grant
retry. Callback is already consumed, so recovery is a new login. Startup discovery outage fails
startup/readiness. Fixed safe metadata probes recover a known later outage. Existing local
sessions require no issuer request. No token refresh, user-info fetch or automatic grant retry.

Cookies use `__Host-jeeves-<lead>-session`/`-login`/`-guest`, Path=/, Secure, HttpOnly, SameSite=Lax,
no Domain. Only the session cookie's SHA256 hash is stored.
The compiled namespace also includes selected Identity. Each persisted login/session row and
private seal/CSRF binding includes a hash of the exact issuer URL and client. Authority changes
refuse old cookies and old login transactions. Revoke/drain the old export's compiled scope before
changing the Identity link; migrate/clean retained state explicitly. Display-label renames do not
change these identities. Subject revocation spans all issuer/client authority versions inside its
compiled owning namespace. Database time controls idle/absolute
expiry; each session persists its idle seconds and absolute deadline. Policy reductions do not
rewrite existing promises. Expiry or local revocation drops token material irreversibly. Optional
absent cookie is anonymous, Required product routes401; supplied invalid/expired/duplicate cookies
401 and clear even on Optional/background routes. Mixed bearer credentials refuse. A failed
identity is never silently anonymous. Bootstraps are explicit generated exceptions: GET session
without identity returns signedIn:false even for Required hosts.

GET `/session` returns safe identity and CSRF, never tokens or cookie material. With guest context
enabled it establishes a signed24-hour HttpOnly guest cookie; product gets only its opaque hash
as immutable caller.guest.id. Unsafe stateful requests require exact Origin and X-CSRF-Token
bound to the active session or guest context. Guest mutation before bootstrap403s. A session
supersedes guest identity; callback/session clears guest. POST `/logout` requires that policy for
a supplied browser context and locally revokes it. A truly cookieless logout is204 with no
Set-Cookie mutation, preventing omitted Lax cookies being cleared by cross-site POST. Common HTTP
adapters fix no-store/no-referrer/status/clear behavior even with a product error-body formatter.

Generated internal command:
`node dist/operations/<process>-<lead>-revoke-subject.js <subject>` revokes all currently existing
sessions in that compiled owner/module scope and erases sealed material. It needs no issuer.
Subjects share one UTF8<=255/non-control/string validation at sign-in/revocation. This is local
session invalidation, not issuer-wide logout, permanent sign-in ban, user-management UI, or account
erasure. Product hooks receive bounded immutable facts, no table/transaction/token/cookie handles.
Independent15s maintenance removes at most100 expired login rows and100 expired/revoked sessions
per sweep; it makes no cleanup-throughput guarantee. Real local issuer/two-copy failure proof
remains at the assigned later checkpoint; RG19 uses offline SQL/role and SDK/protocol stand-ins.
