import Fastify, { type FastifyInstance } from "fastify";

export type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "unreachable";
  version: string;
};

export type AppDeps = {
  pingDb: () => Promise<void>;
  version: string;
  logger?: boolean;
};

/** Builds the API without listening, so tests can use `app.inject`. */
export function buildApp({ pingDb, version, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.get("/health", async (_req, reply) => {
    let database: HealthResponse["database"] = "ok";
    try {
      await pingDb();
    } catch (err) {
      app.log.warn({ err }, "database ping failed");
      database = "unreachable";
    }
    const body: HealthResponse = {
      status: database === "ok" ? "ok" : "degraded",
      database,
      version,
    };
    return reply.code(database === "ok" ? 200 : 503).send(body);
  });

  return app;
}
