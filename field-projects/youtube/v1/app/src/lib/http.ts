import Fastify, { type FastifyInstance } from "fastify";
import { Unimplemented } from "./env.ts";
export interface HttpSettings {
  requestTimeoutMs: number;
  concurrencyLimit: number;
}
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
// Auth/JWKS and dependency work must run inside the awaited handler, not async preHandler hooks.
// Handlers must await/return all admitted work. A timed-out task retains its slot until settled.
export async function createHttpService(
  id: string,
  declared: HttpSettings,
  configure: (app: FastifyInstance) => Promise<void> | void,
  initialize: () => Promise<void> = async () => {},
) {
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  let ready = false,
    active = 0;
  app.addHook("onRoute", (route) => {
    if (route.url === "/healthz") return;
    const original = route.handler;
    route.handler = async function (req, reply) {
      if (active >= declared.concurrencyLimit)
        throw new HttpError(503, "OVERLOADED", "Service is busy.");
      active++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const work = Promise.resolve()
        .then(() => original.call(this, req, reply))
        .finally(() => {
          active--;
        });
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new HttpError(
                    503,
                    "DEADLINE",
                    "Request deadline exceeded; check status before retrying.",
                  ),
                ),
              declared.requestTimeoutMs,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
  });
  app.get("/healthz", async (_req, reply) => {
    if (!ready) reply.code(503);
    return { service: id, application: ready ? "ready" : "uninitialized" };
  });
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _req, reply) => {
    const status = error.statusCode ?? 500;
    reply
      .header("Cache-Control", "no-store")
      .code(status)
      .send({
        error:
          status >= 500 && status !== 501 && !(error instanceof HttpError)
            ? "UNAVAILABLE"
            : (error.code ?? "INVALID_REQUEST"),
        message:
          status >= 500 && !(error instanceof HttpError) && !(error instanceof Unimplemented)
            ? "Service unavailable."
            : error.message,
      });
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setNotFoundHandler(async () => {
    throw new Unimplemented(`${id} routes (G01–G07)`);
  });
  await configure(app);
  return {
    app,
    async start(options = { host: "0.0.0.0", port: 3000 }) {
      await initialize();
      ready = true;
      try {
        await app.listen(options);
      } catch (e) {
        ready = false;
        throw e;
      }
    },
    async close() {
      ready = false;
      await app.close();
    },
  };
}
export async function httpShell(id: string, declared: HttpSettings) {
  const service = await createHttpService(
    id,
    declared,
    (app) => {
      app.get("/scaffold", async () => ({
        id,
        declared,
        enforced: false,
        application: "unimplemented",
      }));
    },
    async () => {
      throw new Unimplemented(`${id} startup: business handlers are not implemented`);
    },
  );
  await service.start();
  return service.app;
}
