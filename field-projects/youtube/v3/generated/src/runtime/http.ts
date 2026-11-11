import Fastify, { type HTTPMethods, type RouteHandlerMethod } from "fastify";
import { createAdmission, HttpError, type HttpSettings } from "./admission.ts";
export { HttpError, type HttpSettings } from "./admission.ts";

/** Configure routes before listening. Auth/JWKS and every dependency/effect belong inside
 * the awaited handler. No lifecycle/plugin hooks are exposed outside that handler budget. */
export interface HttpRoutes {
  route(options: {
    method: HTTPMethods | HTTPMethods[];
    url: string;
    handler: RouteHandlerMethod;
  }): void;
}
export async function createHttpService(options: {
  id: string;
  settings: HttpSettings;
  configure: (routes: HttpRoutes) => void | Promise<void>;
  initialize: () => Promise<void>;
}) {
  const admission = createAdmission(options.settings);
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  let state: "uninitialized" | "ready" | "draining" = "uninitialized";
  let starting: Promise<string> | undefined;
  let shutdown: Promise<void> | undefined;
  app.get("/healthz", async (_request, reply) => {
    if (state !== "ready") reply.code(503);
    return { service: options.id, application: state };
  });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    const status =
      error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
    const clientError = status === 400 || status === 413 || status === 415;
    reply.code(clientError ? status : 503).send({
      error: clientError ? "INVALID_REQUEST" : "UNAVAILABLE",
      message: clientError ? "Invalid request." : "Service unavailable.",
    });
  });
  app.setNotFoundHandler(async () => {
    throw new HttpError(404, "NOT_FOUND", "Route not found.");
  });
  await options.configure({
    route({ handler, ...route }) {
      if (route.url === "/healthz") throw new Error("Reserved readiness route");
      app.route({
        ...route,
        handler(request, reply) {
          return admission.run(() => handler.call(this, request, reply));
        },
      });
    },
  });
  return {
    /** Injection is useful for offline adapters; it does not advertise readiness before start. */
    inject: app.inject.bind(app),
    start(listen: { host: string; port: number }): Promise<string> {
      if (shutdown) return Promise.reject(new Error("HTTP service is draining"));
      return (starting ??= (async () => {
        await options.initialize();
        if (shutdown) throw new Error("HTTP service is draining");
        const address = await app.listen(listen);
        if (!shutdown) {
          state = "ready";
          admission.open();
        }
        return address;
      })());
    },
    close(): Promise<void> {
      state = "draining";
      admission.stop();
      return (shutdown ??= (async () => {
        await starting?.catch(() => {});
        try {
          await app.close();
        } finally {
          await admission.drain();
        }
      })());
    },
  };
}
