# Pinned refresh API review

RG20 keeps RG19's exact generated pins: openid-client6.8.9, JOSE6.2.13 and
scoped oauth4webapi3.8.8. No dependency/package/lock/workspace asset changes are needed.

Reviewed primary sources:

- [Tagged refreshTokenGrant](https://github.com/panva/openid-client/blob/v6.8.9/docs/functions/refreshTokenGrant.md):
  configuration + refresh token, optional additional parameters/DPoP options. No invented
  RefreshTokenGrantChecks API or hand-written protocol verifier.
- [Tagged implementation](https://github.com/panva/openid-client/blob/v6.8.9/src/index.ts):
  refresh token response processing and optional ID-token signature validation use the same
  configured issuer/client and enabled nonrepudiation checks. Any returned subject must also
  match the existing stored session subject; absent ID tokens remain valid. DPoP retry requires
  DPoP configuration, which this finite adapter does not supply. Actual proof observes one POST
  per invocation across all failure cases.
- [oauth4webapi3.8.8](https://github.com/panva/oauth4webapi/blob/v3.8.8/src/index.ts):
  OAuth error body parsing applies to4xx. The pinned SDK exposes a5xx unexpected status as
  ClientError OAUTH_RESPONSE_IS_NOT_CONFORM with Response cause; that positive429/5xx status
  is an availability failure. Recognized invalid_grant400/401/403 is definitive authentication
  refusal. Network, malformed successful responses and unfamiliar validation/dependency
  failures remain uncertain, never silently anonymous.

[Actual emitted SDK proof](sdk-final-bound.txt) uses real pinned library/JOSE, signed RS256 optional
ID tokens and HTTPS fetch stand-ins. It validates valid/omitted tokens, rejects subject/workload/
issuer/audience/signature/expiry mismatches without adopting credentials, distinguishes known
invalid grant/provider/unknown outcomes, refuses unsupported<=20s successful grants, caps actual
pending refreshes at32 beyond cancellation and exercises fixed3s SDK timeout. No native issuer,
provider provisioning or real competing-process proof is claimed here.

Pinned E9 comparisons remain reference-only: A rotates before its optimistic winner check and can
revoke after a competing successful rotation; B uses a row lock but allows expired-cookie recovery
when its test clock moves back. RG20 coordinates before dispatch, persists uncertainty across
rollback, preserves RG19's irreversible store-time session expiry and has no production clock seam.

Private database timing was checked against actual pinned pg8.23.1 Client.query, whose per-query
query_timeout takes precedence over connectionParameters.query_timeout.
[Real driver proof](driver-bound-final.txt) observes5500ms for the private configuration and2500ms
for a subsequent ordinary query, using an unconnected Client and controlled timer observation.
The [tagged primary implementation](https://github.com/brianc/node-postgres/blob/v8.23.1/packages/pg/lib/client.js)
and actual emitted-project driver source agree; no fake compile declaration is used.
