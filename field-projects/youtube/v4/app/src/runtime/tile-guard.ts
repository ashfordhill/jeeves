// Generated scaffold: an Auth guard's sign-in for its tile (v3 contract, section 2).
// Export rewrites this file. Required: every module route needs a valid token. Optional: a request
// without one is anonymous, and a token that fails verification is still refused.
import type { FastifyRequest } from "fastify";
import { HttpError } from "./admission.ts";
import type { HttpRoutes } from "./http.ts";
import type { VerifiedPrincipal } from "./identity.ts";

/** Who called: a verified account, or anonymous. */
export type Caller = { signedIn: true; principal: VerifiedPrincipal } | { signedIn: false };
export type SignIn = "required" | "optional";
export interface TileGuard {
  /** The caller, verified once per request: anonymous without an Authorization header; a token
   * that fails verification (a key-set failure included) answers 401. */
  caller(request: FastifyRequest): Promise<Caller>;
  /** The verified principal; an anonymous caller answers 401. */
  require(request: FastifyRequest): Promise<VerifiedPrincipal>;
}

const refused = () => new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
const anonymous: Caller = { signedIn: false };

export function createTileGuard(options: {
  signIn: SignIn;
  verify(bearer: string): Promise<VerifiedPrincipal>;
}) {
  if (options.signIn !== "required" && options.signIn !== "optional")
    throw new Error("Invalid sign-in setting");
  const callers = new WeakMap<FastifyRequest, Promise<Caller>>();
  const resolve = async (request: FastifyRequest): Promise<Caller> => {
    const header = request.headers.authorization;
    if (header === undefined) return anonymous;
    const token = typeof header === "string" ? /^Bearer (\S{1,16384})$/i.exec(header)?.[1] : undefined;
    if (!token) throw refused();
    try {
      return { signedIn: true, principal: await options.verify(token) };
    } catch {
      throw refused();
    }
  };
  const guard: TileGuard = {
    caller(request) {
      let caller = callers.get(request);
      if (!caller) {
        caller = resolve(request);
        callers.set(request, caller);
      }
      return caller;
    },
    async require(request) {
      const caller = await guard.caller(request);
      if (!caller.signedIn) throw refused();
      return caller.principal;
    },
  };
  return {
    ...guard,
    signIn: options.signIn,
    /** Routes whose handlers check the caller first: Required needs a verified principal; Optional
     * verifies a token when one is sent. Every module route of the tile is mounted through them. */
    routes(routes: HttpRoutes): HttpRoutes {
      return {
        route({ handler, ...route }) {
          routes.route({
            ...route,
            async handler(request, reply) {
              if (options.signIn === "required") await guard.require(request);
              else await guard.caller(request);
              return handler.call(this, request, reply);
            },
          });
        },
      };
    },
    /** GET `url`: the signed-in caller's subject and username, or anonymous. */
    me(routes: HttpRoutes, url: string) {
      routes.route({
        method: "GET",
        url,
        handler: async (request) => {
          const caller = await guard.caller(request);
          if (!caller.signedIn) return { signedIn: false };
          const username = caller.principal.claims.preferred_username;
          return {
            signedIn: true,
            subject: caller.principal.subject,
            username: typeof username === "string" ? username : null,
          };
        },
      });
    },
  };
}
