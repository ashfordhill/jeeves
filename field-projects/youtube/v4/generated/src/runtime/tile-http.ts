import type { FastifyRequest } from "fastify";
import { HttpError } from "./admission.ts";
import type { HttpRoutes } from "./http.ts";
import { isNotImplemented, notImplementedWhat, type NotImplementedLog } from "./tile-process.ts";
import type { Caller, ModuleRequest, ModuleResponse } from "../modules/entry.ts";

/** A module's routes: "Not implemented" answers 501 with one rate-limited log line. Any other
 * error keeps the HTTP service's own mapping (an HttpError its status, anything else 503). */
export function notImplementedRoutes(
  routes: HttpRoutes,
  log: NotImplementedLog,
  module: string,
): HttpRoutes {
  return {
    route({ handler, ...route }) {
      routes.route({
        ...route,
        async handler(request, reply) {
          try {
            return await handler.call(this, request, reply);
          } catch (error) {
            if (!isNotImplemented(error)) throw error;
            log({
              module,
              what: notImplementedWhat(error),
              route: `${request.method} ${route.url}`,
              action: "answered 501",
            });
            throw new HttpError(501, "NOT_IMPLEMENTED", error.message);
          }
        },
      });
    },
  };
}

const anyMethod = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const;
const anonymous = async (): Promise<Caller> => ({ signedIn: false });
async function moduleRequest(
  request: FastifyRequest,
  caller: (request: FastifyRequest) => Promise<Caller>,
): Promise<ModuleRequest> {
  const rest = (request.params as { "*"?: string })["*"];
  return {
    method: request.method,
    path: `/${rest ?? ""}`,
    query: request.query as ModuleRequest["query"],
    headers: request.headers,
    body: request.body,
    caller: await caller(request),
  };
}
/** A route stub answers any method on /modules/<module> and every path below it. `caller` is the
 * tile's Auth guard's, or anonymous. */
export function stubRoutes(
  routes: HttpRoutes,
  log: NotImplementedLog,
  module: string,
  entry: (request: ModuleRequest) => Promise<ModuleResponse>,
  caller: (request: FastifyRequest) => Promise<Caller> = anonymous,
): void {
  const mounted = notImplementedRoutes(routes, log, module);
  for (const url of [`/modules/${module}`, `/modules/${module}/*`])
    mounted.route({
      method: [...anyMethod],
      url,
      async handler(request, reply) {
        const response = await entry(await moduleRequest(request, caller));
        reply.code(response.status ?? 200);
        for (const [name, value] of Object.entries(response.headers ?? {})) reply.header(name, value);
        return response.body;
      },
    });
}
