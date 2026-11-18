# Pinned OIDC API review

Selected maintained `openid-client`6.8.9. npm primary registry reports publication
2026-11-02T08:49:27.763Z, more than14 days before2026-11-17. The generated dependency is exact;
only generated package/lock/workspace/Docker assets changed. Existing JOSE6.2.13 is reused through
a scoped override; oauth4webapi3.8.8 (2026-09-05) is locked/scoped as well. No root dependency edit.
[Registry receipt](oidc-pin.json).

Primary tagged API sources reviewed:

- [OIDC example](https://github.com/panva/openid-client/blob/v6.8.9/examples/oidc.ts): code grant,
  PKCE challenge construction, expected nonce and identity claims.
- [Discovery](https://github.com/panva/openid-client/blob/v6.8.9/docs/functions/discovery.md)
  and [options](https://github.com/panva/openid-client/blob/v6.8.9/docs/interfaces/DiscoveryRequestOptions.md):
  issuer-identifier discovery (preserves issuer checking), fixed timeout and private custom fetch.
- [Grant checks](https://github.com/panva/openid-client/blob/v6.8.9/docs/interfaces/AuthorizationCodeGrantChecks.md):
  `expectedState`, `expectedNonce`, `pkceCodeVerifier`, ID-token requirement.
- [Signature checking](https://github.com/panva/openid-client/blob/v6.8.9/docs/functions/enableNonRepudiationChecks.md):
  explicitly enable ID-token JWS validation rather than relying only on token-endpoint TLS.
- [Custom fetch](https://github.com/panva/openid-client/blob/v6.8.9/docs/variables/customFetch.md):
  private cancellation/byte-bound transport; no product overrides or insecure execute hook.
- [Pinned error mapping](https://github.com/panva/openid-client/blob/v6.8.9/src/index.ts)
  and [oauth4webapi3.8.8 errors](https://github.com/panva/oauth4webapi/blob/v3.8.8/src/index.ts):
  positive known authentication-refusal classification only. INVALID_RESPONSE is overloaded:
  callback-parameter/signature failures can be401, whereas malformed JWKS/provider bodies must
  remain dependency/unknown. No protocol validation or crypto is reimplemented in this adapter.

[Actual proof](protocol-classified.txt) runs the emitted adapter with the actual pinned library,
RS256 signed tokens and HTTPS fetch stand-ins. It observes valid sign-in; state-before-POST;
nonce/PKCE/signature/issuer/audience/expiry/subject/workload refusal; startup outage and response
bounds; token network/503/429/malformed body/invalid-client/malformed-JWKS unknown classification;
and deterministic gated cancellation preserving32 actual pending slots/no33rd dispatch.
Library API selection is primary-source verified; native issuer interoperability remains a later
assigned checkpoint, not a claim from these stand-ins.
