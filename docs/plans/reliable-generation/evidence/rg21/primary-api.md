# Pinned primary API review

RG21 retains the accepted exact generated pins and adds no dependency/install to unit tests.
Reviewed tagged primary sources:

- [openid-client6.8.9 refreshTokenGrant](https://github.com/panva/openid-client/blob/v6.8.9/docs/functions/refreshTokenGrant.md): RG20's maintained refresh entrypoint and exact issuer/client configuration remain; no grant retry/DPoP adapter is added.
- [JOSE6.2.13 jwtVerify](https://github.com/panva/jose/blob/v6.2.13/docs/jwt/verify/functions/jwtVerify.md): cryptographic JWS plus configured issuer/audience/algorithm/required exp/sub validation. Subject continuity and signed workload-claim exclusion are adapter policy.
- [JOSE6.2.13 createRemoteJWKSet](https://github.com/panva/jose/blob/v6.2.13/docs/jwks/remote/functions/createRemoteJWKSet.md): existing pinned maintained key selection/cache, timeout and custom-fetch support. The browser issuer's HTTPS/byte-bound transport is reused. Actual pinned TypeScript exposed different JOSE versus OIDC fetch option types; explicit body/Headers conversion now uses their real types, with no fabricated declarations.

[Actual SDK proof](sdk-complete.txt) uses the actual emitted adapter and installed pinned JOSE/openid-client with signed RS256 tokens and HTTPS fetch stand-ins. Valid audience/subject verifies; wrong subject/issuer/audience/signature/expiry/workload claim refuses before forwarding; one maintained refresh POST issues a verified replacement and the JWKS cache is reused. The real extension checker refuses a product import of the private credential provider. No live issuer, new provider or native composed certification is claimed.

E9 pinned QRWTY A's forwarding and OIDC source were read reference-only at0647e4a. Its product route map and headers are product policy; its hand-written grant/refresh behavior is not copied. RG21's declared roots, independent workload credentials and private generation-aware coordination use Jeeves's accepted contracts.
