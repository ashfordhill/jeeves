import { createRemoteJWKSet, jwtVerify } from "jose";
import { required } from "./env.ts";

const jwks = createRemoteJWKSet(
  new URL("http://identity:8080/realms/youtube-v1/protocol/openid-connect/certs"),
);
export async function creatorToken(bearer: string) {
  const { payload } = await jwtVerify(bearer, jwks, {
    issuer: required("OIDC_ISSUER"),
    audience: "youtube-v1-api",
    algorithms: ["RS256"],
    requiredClaims: ["exp", "sub"],
  });
  const roles = (payload.realm_access as { roles?: unknown } | undefined)?.roles;
  if (
    typeof payload.sub !== "string" ||
    !payload.sub ||
    !Array.isArray(roles) ||
    !roles.includes("creator")
  )
    throw Object.assign(new Error("Creator role required"), { statusCode: 403 });
  return payload;
}
// No upload routes are authenticated until the custom routes explicitly call this helper.
