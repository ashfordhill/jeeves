# Auth0 generator evidence

Started from Jeeves `b908cf1be340446553eacb31f722f0215052f86d` at 20:07 UTC on 2026-11-19. This unit is template development. The worker's prompt and model family are in the [usage ledger](../usage-ledger.md). Model version, token breakdown and cost were unavailable to the worker.

## Generated behavior

The Identity field offers **Keycloak** (`oidc`) and **Auth0** (`auth0`) when the installed modules use it. An older absent field resolves to Keycloak. Saving this choice changes the provider without changing the Browser session's Sign-in, guest or refresh choices. The reviewed QRWTY parent already chose Optional browser and Link, Required Account and Billing, and enabled automatic refresh.

Auth0 binds the exact HTTPS issuer origin with its trailing slash. The browser and user guards share the registered API audience. Workload tokens have one configured service audience and signed default-profile client credentials claims. Each receiver checks the subject, issuer, expiry, audience and compiled caller allowlist separately from the user. A valid Optional guest can use a declared call without a user bearer. A bad supplied cookie is refused before this path. Auth0 uses the existing protected session state and refresh-uncertainty protocol. Logout commits local revocation across copies and returns a registered provider logout URL for the browser to navigate to. The export includes private binding names and registration steps.

## Reproduction

Use Node 24.21.0 and pnpm 12.16.1 from the Jeeves checkout. Native commands build public CLI exports, run independent application containers against real PostgreSQL and preserve the harness result and cleanup logs.

```sh
pnpm test:generated --suite=qr-auth0 --artifacts=/absolute/empty/auth0
pnpm test:generated --suite=rg-mechanisms --test-name='link/account sessions' --artifacts=/absolute/empty/keycloak
pnpm check
pnpm test:e2e
pnpm --filter @jeeves/web build
```

The Auth0 fixture uses [a purpose-built Browser → Account → Billing and optional Link design](../../../../../field-projects/generator-system/fixtures/qr-auth0/design.ts), a disposable TLS issuer with synthetic users and real RS256 signatures, and application-owned test routes. The smaller browser-only study exercises the provider from an older saved design by mouse and through chat. The native bearer `/me` request uses its own Authorization header and no browser cookie. The native mock keeps real tenant observations pending.

## Export and observed outcomes

- From a scratch copy of the reviewed revision-4 JSON, changing only `settings.provider` to Auth0 produced 151 files, zero findings and 24 required application/integration gaps. The design SHA-256 is `dfbb8b63b8ad58b84524b75ace0f693aa1cfcfc314b97d6abd8a87bfa260dff5`. Manifest SHA-256 `d0c5d736fdcae23a3df640253b036019b7e77631e834c51c209d4a4aabc0caf5`. Deployment contract SHA-256 `f7fba26d0bd649f504a018611b0b9e30cb3a554066f17dd141c3d76c0959aed7`. These are raw hashes before compression. [Manifest](auth0-only-manifest.json.gz) · [Deployment contract](auth0-only-deploy-contract.json.gz)
- Public CLI export with only the reviewed Identity's provider field omitted initially refused its missing provenance path. After using the existing parent settings object for the default, it emitted 152 files, zero findings and the Keycloak stack. The form shows Keycloak, and export preserves the absent field in the saved design. `pnpm --filter @jeeves/generator export:v2 <design> <directory>` and the offline `pnpm install --frozen-lockfile --offline && pnpm build` passed on the Auth0 export. `pnpm --filter @jeeves/generator update:v2 <design> <directory> --check` reported 150 unchanged files and zero creates, replaces or removes.
- The Auth0 fixture published 83 files and built with only its declared extension files filled. An Alice login reached Billing via Account, Bob's product read returned 404, guest Link returned 200, and guest Account and an invalid supplied cookie returned 401. Missing, wrong-audience and expired user tokens returned 401. A machine token could not establish a user, and a user token could not establish a machine. A valid machine token for an undeclared caller received 403. The direct bearer route returned 200 with the expected user.
- Two browser copies called the same session after its access expiry. The fixture recorded one refresh, one rotation and committed generation `1` with uncertainty false. Restarting a copy reused the session. A temporary refresh-endpoint outage produced 503 on forwarding, preserved local identity and recovered to 200. A later reply that omitted the replacement refresh token recorded durable uncertainty. A request to the other copy received 503 with zero repeated grants. A protected logout committed revocation, the fixture's OIDC endpoint redirected to the registered return, and the retired cookie received 401 on the other copy. [Native results](native-auth0-observations.json.gz) · [Cleanup](native-auth0-cleanup.json.gz)

- The native Keycloak regression ran the same retained rotation protocol under real Keycloak 26.8.1. Two copies shared one refresh, a temporary failure preserved the session, a lost reply recorded uncertainty, and a definitive invalid grant revoked the session. The native Auth0 and Keycloak stacks cleaned up their owned Docker resources. [Keycloak session observations](native-keycloak-sessions.json.gz) · [Cleanup](native-keycloak-cleanup.json.gz)
- `pnpm check` passed all 1,442 tests in 155 files, lint and workspace type checks. The serial `pnpm test:e2e` run passed 91/91 (6.0 minutes). The web build passed with its existing chunk advisory. TinyURL and the older browser-only project rendered in the running E2E Studio. The latter showed the default Keycloak value, selected Auth0 by mouse, persisted it through reload, returned it in blueprint v3 and downloaded the ZIP. [Inspector screenshot](mouse-auth0-identity.png)

## Earlier attempts

- The first focused package run passed 95 tests and found three expected golden hash differences for changed private runtime and provenance files. The processes-off fixture counts stayed at 82, 89 and 62.
- The first native Auth0 run built the framework through its API v8 checker and stopped on two synchronous fixture route signatures. Both application-owned fixture functions now return promises. The native reruns passed. [First result](native-auth0-first-attempt.json.gz)
- The first Keycloak fixture attempt refused because a fixture file was edited during startup. The final run used stable source.
- The first repository check caught a raw baseline artifact that Biome treated as source. The baseline was archived without changing raw bytes. The second check found two older inventory assertions missing the new private Auth0 helper import. Those assertions now track its emitted path and environment-reader closure.
- The first E2E run passed the Auth0 and TinyURL cases, with 79 passed and 12 failures overall. A captured trace showed Chromium `ERR_NETWORK_CHANGED` during native Compose startup. The repeat ran after native container and network cleanup.

## Real Auth0 tenant pending

Access needed is a designated test tenant and two test users. Register a Regular Web Application for authorization code with S256 and `client_secret_post`. Register the exact HTTPS callback and same-origin Allowed Logout URL from the export. Enable the Refresh Token grant, rotation and offline access on the user API. Select RS256 and the default Auth0 access-token profile. Register distinct API identifiers for the user API and each machine recipient, cap machine token lifetime at 300 seconds, turn off user access on the machine APIs and machine access on the user API, and grant each machine app only its declared targets. Use the tenant or custom domain that issues the JWTs throughout. [Token profile](https://auth0.com/blog/jwt-access-tokens-profiles-now-in-ga/) · [API access policies](https://auth0.com/docs/get-started/apis/api-access-policies-for-applications) · [Refresh rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation) · [OIDC logout](https://auth0.com/docs/authenticate/login/logout/log-users-out-of-auth0)

For the reviewed QRWTY shape, the browser binds `JEEVES_AUTH0_IDENTITY_ISSUER`, `JEEVES_AUTH0_IDENTITY_AUDIENCE`, `JEEVES_BROWSER_BROWSER_SESSION_CLIENT_ID`, `JEEVES_BROWSER_BROWSER_SESSION_CALLBACK`, `JEEVES_BROWSER_BROWSER_SESSION_LOGOUT_RETURN`, the confidential secret and the shared session key ring files. Account and Billing verify that same issuer and user audience. Each workload process binds its own `JEEVES_AUTH0_IDENTITY_SERVICE_<PROCESS>_CLIENT_ID`, `_AUDIENCE` and secret, plus the declared caller IDs and target audiences from `deploy/contract.json`.

Drive the HTTPS login and callback through Auth0 Universal Login on the designated tenant, then read the owned fixture account through Browser → Account → Billing. Verify a guest through Browser → Link and a denial at Account, a second user's isolation, and independent rejection of a user token with another API audience and a machine client with no declared caller grant. Share a browser cookie across two Browser copies, let the access token expire, issue two calls and confirm one Auth0 rotating refresh and one database generation advance. Restart one copy and read through the other, POST logout with CSRF, navigate to the returned Auth0 URL and observe the registered return. Verify both copies reject the retired cookie, then sign in again. Save only redacted tenant observations, request counts, statuses and configuration names.
