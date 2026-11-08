import Fastify from "fastify";
import { Unimplemented } from "./env.ts";
export async function httpShell(
  id: string,
  declared: { requestTimeoutMs: number; concurrencyLimit: number },
) {
  // Fastify requestTimeout bounds incoming request reception, not handler execution.
  // Declared execution timeout/concurrency remain custom; see scaffold report.
  const app = Fastify({ logger: false, bodyLimit: 1048576 });
  app.get("/healthz", async () => ({
    service: id,
    shell: "running",
    application: "unimplemented",
  }));
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    reply
      .code(error.statusCode ?? 500)
      .send({ error: error.code ?? "INTERNAL_ERROR", message: error.message });
  });
  app.setNotFoundHandler(async () => {
    throw new Unimplemented(`${id} routes (G01–G07)`);
  });
  app.get("/scaffold", async () => ({ id, declared, enforced: false }));
  await app.listen({ host: "0.0.0.0", port: 3000 });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void app.close();
    });
  return app;
}
