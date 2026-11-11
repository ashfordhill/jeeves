import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from "jose";

export interface IdentityBinding {
  issuer: string;
  audience: string | readonly string[];
  jwksUrl: string;
  algorithms: readonly string[];
  jwksTimeoutMs: number;
}
export interface VerifiedPrincipal {
  subject: string;
  claims: JWTPayload;
}

/** Cryptographic identity only. Role/ownership/product authorization stays in the caller.
 * Call and await verify inside the HTTP handler, including any remote JWKS work. */
export function createPrincipalVerifier(binding: IdentityBinding, keySet?: JWTVerifyGetKey) {
  const url = new URL(binding.jwksUrl);
  if (
    !binding.issuer ||
    !binding.audience.length ||
    !["http:", "https:"].includes(url.protocol) ||
    !binding.algorithms.length ||
    binding.algorithms.some(
      (algorithm) => !/^(?:RS|PS|ES)(?:256|384|512)$|^EdDSA$/.test(algorithm),
    ) ||
    !Number.isSafeInteger(binding.jwksTimeoutMs) ||
    binding.jwksTimeoutMs < 1
  )
    throw new Error("Invalid verified identity binding");
  const jwks = keySet ?? createRemoteJWKSet(url, { timeoutDuration: binding.jwksTimeoutMs });
  const issuer = binding.issuer;
  const audience = typeof binding.audience === "string" ? binding.audience : [...binding.audience];
  const algorithms = [...binding.algorithms];
  return async function verify(bearer: string): Promise<VerifiedPrincipal> {
    if (!bearer || bearer.length > 16384) throw new Error("Invalid identity token");
    const { payload } = await jwtVerify(bearer, jwks, {
      issuer,
      audience,
      algorithms,
      requiredClaims: ["exp", "sub"],
    });
    if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255)
      throw new Error("Invalid identity subject");
    return { subject: payload.sub, claims: payload };
  };
}
